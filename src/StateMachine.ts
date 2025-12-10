import {
  Action,
  StateNodeConfig,
  TransitionConfig,
  TransitionResult,
  NoInfer,
} from './types';

import { MachineContext, EventObject, MachineConfig, Snapshot } from './types';

/**
 * Responsibilities:
 * - Define the machine configuration
 * - Defines how to transition from one state to another
 * All _pure_ calculations.
 */
export class StateMachine<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateValue extends string
> {
  constructor(readonly config: MachineConfig<TContext, TEvent, TStateValue>) {}

  private getTransition(state: TStateValue, event: TEvent, context: TContext) {
    const stateNode = this.config.states[state];

    const guards =
      stateNode.on?.[event.type as keyof typeof stateNode.on]?.guards;
    const blockingGuards =
      guards?.some((guard) => !guard.condition(context, event)) ?? false;
    if (blockingGuards) return;

    let transition = stateNode.on?.[event.type as keyof typeof stateNode.on];
    if (transition === undefined) {
      transition = this.config.on?.[
        event.type as keyof typeof this.config.on
      ] as TransitionConfig<TContext, TEvent, TStateValue>;
    }
    return transition;
  }

  getInitialSnapshot(): Snapshot<TContext, TStateValue> {
    return {
      status: 'active',
      context: { ...this.config.context } as TContext,
      value: this.config.initial,
    };
  }

  /**
   * Transitions the machine from the current state to the target state.
   * @returns The new state and the actions to execute
   */
  transition(
    snapshot: Snapshot<TContext, TStateValue>,
    event: TEvent
  ): TransitionResult<TContext, TStateValue, TEvent> | undefined {
    const currentState = snapshot.value;
    const transition = this.getTransition(
      currentState,
      event,
      snapshot.context
    );
    if (!transition) {
      return undefined;
    }

    const targetState = transition.target || currentState;
    const actions: Action<TContext, TEvent, TStateValue>[] = [];

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

export const createMachine = <
  TContext extends MachineContext,
  TEvent extends EventObject,
  TState extends string
>(
  config: Omit<
    MachineConfig<TContext, TEvent, string>,
    'states' | 'initial'
  > & {
    states: Record<TState, StateNodeConfig<TContext, TEvent, TState>>;
    initial: NoInfer<TState>;  // Validated against TState, but doesn't participate in inference
  }
): StateMachine<TContext, TEvent, TState> => {
  return new StateMachine(config as MachineConfig<TContext, TEvent, TState>);
};
