import { ActionExecutor, TransitionResult } from './types';

import { Actor } from './Actor';
import {
  MachineContext,
  EventObject,
  MachineConfig,
  StateValue,
  Snapshot,
} from './types';
/**
 * Responsibilities:
 * - Defined the machine configuration
 * - Define the process of transitioning from one state to another
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
          context: actor.getSnapshot().context,
          event: { type: '$$init' } as TEvent,
          self: actor,
        });
      });
    }

    return actor;
  }

  getTransition(state: StateValue, event: TEvent) {
    const stateNode = this.config.states[state];
    return (
      stateNode?.on?.[event.type as keyof typeof stateNode.on] ||
      this.config.on?.[event.type as keyof typeof this.config.on]
    );
  }

  can(state: StateValue, event: TEvent, context: TContext): boolean {
    const transition = this.getTransition(state, event);
    if (!transition) return false;

    return (
      transition.guards?.every((guard) => guard.condition(context, event)) ??
      true
    );
  }

  getInitialSnapshot(): Snapshot<TContext, StateValue> {
    return {
      status: 'active',
      context: { ...this.config.context },
      value: this.config.initial,
    };
  }

  transition(
    snapshot: Snapshot<TContext, StateValue>,
    event: TEvent
  ): TransitionResult<TContext, StateValue> {
    const currentState = snapshot.value;
    const transition = this.getTransition(currentState, event);

    if (!transition || !this.can(currentState, event, snapshot.context)) {
      return {
        value: currentState,
        actions: [],
      };
    }

    const targetState = transition.target || currentState;
    const actions: ActionExecutor<TContext, TEvent>[] = [];
    let updatedContext = { ...snapshot.context };

    // Collect exit actions
    if (targetState !== currentState) {
      const currentStateNode = this.config.states[currentState];
      if (currentStateNode?.exit) {
        const exitActions = Array.isArray(currentStateNode.exit)
          ? currentStateNode.exit
          : [currentStateNode.exit];
        actions.push(...exitActions);
      }
    }

    // Collect transition actions
    if (transition.actions) {
      const transitionActions = Array.isArray(transition.actions)
        ? transition.actions
        : [transition.actions];
      actions.push(...transitionActions);
    }

    // Collect entry actions
    if (targetState !== currentState) {
      const targetStateNode = this.config.states[targetState];
      if (targetStateNode?.entry) {
        const entryActions = Array.isArray(targetStateNode.entry)
          ? targetStateNode.entry
          : [targetStateNode.entry];
        actions.push(...entryActions);
      }
    }

    return {
      value: targetState,
      actions,
    };
  }
}
