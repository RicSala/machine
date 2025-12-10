import { Action, ActionArgs, MachineContext } from './types';

import { EventObject } from './types';

// actions.ts
export function assign<
  TContext extends MachineContext,
  TEvent extends EventObject,
  TStateValue extends string
>(
  assignment: (context: TContext, event: TEvent) => Partial<NoInfer<TContext>>
): Action<TContext, TEvent, TStateValue> {
  return {
    type: 'xstate.assign',
    exec: ({ context, event }: ActionArgs<TContext, TEvent, TStateValue>) => {
      return assignment(context, event);
    },
  };
}
