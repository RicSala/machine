import { StateMachine } from './StateMachine';
import {
  MachineContext,
  EventObject,
  ActorRef,
  StateValue,
  Snapshot,
  ActionExecutor,
  TransitionResult,
} from './types';

/**
 * Responsibilities:
 * - Executes the logic of the machine
 * - Holdes the state of the running instance (context, status)
 * - Manages subscriptions and notifications
 * - Makes sure events are processed in order
 */
export class Actor<TContext extends MachineContext, TEvent extends EventObject>
  implements ActorRef<TContext, TEvent>
{
  public readonly id: string;
  private snapshot: Snapshot<TContext, StateValue>;
  private machine: StateMachine<TContext, TEvent>;
  private subscribers: Set<(snapshot: Snapshot<TContext, StateValue>) => void>;
  private deferredQueue: Array<() => void> = [];
  private lastSnapshot: Snapshot<TContext, StateValue> | null = null;

  constructor(
    machine: StateMachine<TContext, TEvent>,
    id: string = crypto.randomUUID()
  ) {
    this.id = id;
    this.machine = machine;
    this.snapshot = machine.getInitialSnapshot();
    this.subscribers = new Set();
  }

  getSnapshot = (): Snapshot<TContext, StateValue> => {
    if (this.lastSnapshot !== null) {
      return this.lastSnapshot;
    }

    // Create new snapshot only when needed
    this.lastSnapshot = {
      value: this.snapshot.value,
      context: { ...this.snapshot.context },
      status: this.snapshot.status,
    };

    return this.lastSnapshot;
  };

  private notify(): void {
    if (this.subscribers.size === 0) return;

    // Invalidate cache before notifying subscribers
    this.lastSnapshot = null;

    // Get the snapshot (which will create a new one)
    const snapshot = this.getSnapshot();

    this.subscribers.forEach((subscriber) => {
      try {
        subscriber(snapshot);
      } catch (error) {
        console.error('Error in subscriber:', error);
      }
    });
  }

  private isEqual(a: any, b: any): boolean {
    if (a === b) return true;

    if (a === null || b === null) return a === b;
    if (typeof a !== 'object' || typeof b !== 'object') return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    return keysA.every((key) => this.isEqual(a[key], b[key]));
  }

  subscribe = (
    callback: (snapshot: Snapshot<TContext, StateValue>) => void
  ): (() => void) => {
    // Add the subscriber first
    this.subscribers.add(callback);

    // Send initial notification immediately
    try {
      callback(this.getSnapshot());
    } catch (error) {
      console.error('Error in initial subscriber notification:', error);
    }

    return () => {
      this.subscribers.delete(callback);
    };
  };

  send = (event: TEvent): void => {
    if (this.snapshot.status !== 'active') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Event "${event.type}" was sent to stopped actor "${this.id}"`
        );
      }
      return;
    }

    try {
      // Get next state and actions (pure computation)
      const result: TransitionResult<TContext, StateValue> =
        this.machine.transition(this.snapshot, event);

      // Execute actions and update context
      const newContext = this.executeActions(result.actions, event);

      // Invalidate cache before updating snapshot
      this.lastSnapshot = null;

      // Update snapshot
      const nextSnapshot: Snapshot<TContext, StateValue> = {
        status: this.snapshot.status,
        value: result.value,
        context: newContext,
      };

      // Process deferred actions
      while (this.deferredQueue.length > 0) {
        const fn = this.deferredQueue.shift();
        try {
          fn?.();
        } catch (error) {
          console.error('Error processing queued event:', error);
        }
      }

      // Update state and notify
      this.snapshot = nextSnapshot;
      this.notify();
    } catch (error) {
      this.handleError(error);
    }
  };

  matches = (stateValue: StateValue): boolean => {
    return this.snapshot.value === stateValue;
  };

  can = (event: TEvent): boolean => {
    return this.machine.can(this.snapshot.value, event, this.snapshot.context);
  };

  start = (): void => {
    if (this.snapshot.status !== 'active') {
      // Invalidate cache before updating status
      this.lastSnapshot = null;

      this.snapshot = {
        ...this.snapshot,
        status: 'active',
      };
      this.notify();
    }
  };

  stop = (): void => {
    if (this.snapshot.status !== 'stopped') {
      // Invalidate cache before updating status
      this.lastSnapshot = null;

      this.snapshot = {
        ...this.snapshot,
        status: 'stopped',
      };
      this.notify();
    }
  };

  private executeActions(
    actions: ActionExecutor<TContext, TEvent>[],
    event: TEvent
  ): TContext {
    let context = { ...this.snapshot.context };

    actions.forEach((action) => {
      if (action.type === 'xstate.assign') {
        const updates = action.exec({
          context,
          event,
          self: this,
        });
        context = { ...context, ...updates };
      } else {
        action.exec({
          context,
          event,
          self: this,
        });
      }
    });

    return context;
  }

  private handleError = (error: unknown): void => {
    this.snapshot = {
      ...this.snapshot,
      status: 'error',
    };
    this.notify();
  };
}
