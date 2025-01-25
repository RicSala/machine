import { StateMachine } from './StateMachine';
import {
  MachineContext,
  EventObject,
  ActorRef,
  StateValue,
  Snapshot,
  ActorScope,
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
  private machine: StateMachine<TContext, TEvent>;
  private currentState: StateValue;
  private context: TContext;
  private subscribers: Set<(snapshot: Snapshot<TContext, StateValue>) => void>;
  private lastSnapshot: Snapshot<TContext, StateValue> | null = null;
  private status: 'active' | 'done' | 'error' | 'stopped' = 'active';
  private deferredQueue: Array<() => void> = [];

  constructor(
    machine: StateMachine<TContext, TEvent>,
    id: string = crypto.randomUUID()
  ) {
    this.id = id;
    this.machine = machine;
    this.currentState = machine.getInitialState();
    this.context = machine.getInitialContext();
    this.subscribers = new Set();
  }

  getSnapshot = (): Snapshot<TContext, StateValue> => {
    // If we have a cached snapshot and nothing has changed, return it
    if (this.lastSnapshot !== null) {
      return this.lastSnapshot;
    }

    // Create new snapshot only when needed
    this.lastSnapshot = {
      value: this.currentState,
      context: { ...this.context },
      status: this.status,
    };

    return this.lastSnapshot;
  };

  private notify(): void {
    if (this.subscribers.size === 0) return;

    // Get the snapshot (which might be cached)
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
    if (this.status !== 'active') {
      if (process.env.NODE_ENV === 'development') {
        console.warn(
          `Event "${event.type}" was sent to stopped actor "${this.id}". This actor has already reached its final state, and will not transition.`
        );
      }
      return;
    }

    const actorScope: ActorScope<TContext, TEvent> = {
      self: this,
      id: this.id,
    };

    try {
      const { state: newState, context: newContext } = this.machine.transition(
        this.currentState,
        this.context,
        event,
        actorScope
      );

      // Process all queued events in order
      while (this.deferredQueue.length > 0) {
        const fn = this.deferredQueue.shift();
        try {
          fn?.();
        } catch (error) {
          console.error('Error processing queued event:', error);
        }
      }

      const hasChanged =
        newState !== this.currentState ||
        !this.isEqual(newContext, this.context);

      this.currentState = newState;
      this.context = newContext;

      if (hasChanged) {
        this.lastSnapshot = null;
        this.notify();
      }
    } catch (error) {
      this.handleError(error);
    }
  };

  matches = (stateValue: StateValue): boolean => {
    return this.currentState === stateValue;
  };

  can = (event: TEvent): boolean => {
    return this.machine.can(this.currentState, event, this.context);
  };

  start = (): void => {
    if (this.status !== 'active') {
      this.status = 'active';
      this.lastSnapshot = null;
      this.notify();
    }
  };

  stop = (): void => {
    if (this.status !== 'stopped') {
      this.status = 'stopped';
      this.lastSnapshot = null;
      this.notify();
    }
  };

  private handleError = (error: unknown): void => {
    this.status = 'error';
    this.lastSnapshot = null;
    this.notify();
  };
}
