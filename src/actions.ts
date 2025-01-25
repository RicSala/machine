import { Action } from './types';

import { EventObject } from './types';

// actions.ts
export function assign<TContext, TEvent extends EventObject>(
  assignment: (context: TContext, event: TEvent) => Partial<TContext>
): Action<TContext, TEvent> {
  return {
    type: 'xstate.assign',
    exec: ({ context, event }: { context: TContext; event: TEvent }) => {
      return assignment(context, event);
    },
  };
}
