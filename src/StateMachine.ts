import { Actor } from './Actor';
import {
  MachineContext,
  EventObject,
  MachineConfig,
  StateValue,
  TransitionConfig,
  ActorScope,
  Action,
} from './types';
/**
 * Responsibilities:
 * - Defined the machine configuration
 * - Define the process of transitioning from one state to another
 * -
 */
export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject
> {
  readonly config: MachineConfig<TContext, TEvent>;

  constructor(config: MachineConfig<TContext, TEvent>) {
    this.config = config;
  }

  createActor(): Actor<TContext, TEvent> {
    const actor = new Actor<TContext, TEvent>(this);

    // Execute initial state's entry actions
    const initialState = this.config.states[this.config.initial];
    if (initialState?.entry) {
      const actions = Array.isArray(initialState.entry)
        ? initialState.entry
        : [initialState.entry];

      actions.forEach((action) => {
        action.exec({
          context: actor['context'],
          event: { type: '$$init' } as TEvent,
          self: actor,
        });
      });
    }

    return actor;
  }

  getTransition(
    state: StateValue,
    event: TEvent
  ): TransitionConfig<TContext, TEvent> | undefined {
    // First check state-specific transitions
    const stateNode = this.config.states[state];
    const stateTransition =
      stateNode?.on?.[event.type as keyof typeof stateNode.on];

    if (stateTransition) {
      return stateTransition;
    }

    // If no state-specific transition found, check global transitions
    return this.config.on?.[event.type as keyof typeof this.config.on];
  }

  can(state: StateValue, event: TEvent, context: TContext): boolean {
    const transition = this.getTransition(state, event);
    if (!transition) return false;

    return (
      transition.guards?.every((guard) => guard.condition(context, event)) ??
      true
    );
  }

  getInitialState(): StateValue {
    return this.config.initial;
  }

  getInitialContext(): TContext {
    return { ...this.config.context };
  }

  transition(
    state: StateValue,
    context: TContext,
    event: TEvent,
    actorScope: ActorScope<TContext, TEvent>
  ): { state: StateValue; context: TContext } {
    const transition = this.getTransition(state, event);
    if (!transition) return { state, context };

    if (!this.can(state, event, context)) {
      return { state, context };
    }

    const newContext = { ...context };
    const targetState = transition.target || state;

    // Helper function to execute actions with proper assign handling
    const executeActions = (actions: Action<TContext, TEvent>[]) => {
      actions.forEach((action) => {
        if (action.type === 'xstate.assign') {
          // Handle assign action specially
          const updates = action.exec({
            context: newContext,
            event,
            self: actorScope.self,
          });
          Object.assign(newContext, updates);
        } else {
          // Handle other actions normally
          action.exec({
            context: newContext,
            event,
            self: actorScope.self,
          });
        }
      });
    };

    // handle exit effects of the current state if state changed
    if (targetState !== state) {
      const currentStateNode = this.config.states[state];
      const exitActions = currentStateNode?.exit;

      if (exitActions) {
        executeActions(
          Array.isArray(exitActions) ? exitActions : [exitActions]
        );
      }
    }

    // Execute transition actions
    if (transition.actions) {
      executeActions(
        Array.isArray(transition.actions)
          ? transition.actions
          : [transition.actions]
      );
    }

    // Handle entry effects of the target state if state changed
    if (targetState !== state) {
      const targetStateNode = this.config.states[targetState];
      const entryActions = targetStateNode?.entry;

      if (entryActions) {
        executeActions(
          Array.isArray(entryActions) ? entryActions : [entryActions]
        );
      }
    }

    return {
      state: targetState,
      context: newContext,
    };
  }
}
