import { EventObject, Action, ActorRef } from './types';

export function assign<TContext, TEvent extends EventObject>(
  assignment: (context: TContext, event: TEvent) => Partial<TContext>
): Action<TContext, TEvent> {
  return {
    type: 'xstate.assign',
    exec: ({
      context,
      event,
      self,
    }: {
      context: TContext;
      event: TEvent;
      self: ActorRef<TContext, TEvent>;
    }) => {
      // The actual update will be handled by the machine/actor
      const updates = assignment(context, event);
      return updates; // The machine/actor will apply these updates
    },
  };
}
