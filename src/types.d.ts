export type StateValue = string;
export type EventObject = { type: string; [key: string]: any };
export type MachineContext = Record<string, any>;

export type Guard<TContext, TEvent> = {
  type: string;
  condition: (context: TContext, event: TEvent) => boolean;
};

export interface Action<TContext, TEvent extends EventObject> {
  type: string;
  exec: (args: ActionArgs<TContext, TEvent>) => void;
}

export interface ActionArgs<TContext, TEvent extends EventObject> {
  context: TContext;
  event: TEvent;
  self: ActorRef<TContext, TEvent>;
}

export interface TransitionConfig<TContext, TEvent extends EventObject> {
  target?: StateValue;
  guards?: Guard<TContext, TEvent>[];
  actions?: Action<TContext, TEvent>[];
  reenter?: boolean;
}

export interface StateNodeConfig<TContext, TEvent extends EventObject> {
  on?: {
    [K in TEvent['type']]?: TransitionConfig<TContext, TEvent>;
  };
  entry?: Action<TContext, TEvent>[];
  exit?: Action<TContext, TEvent>[];
}

export interface MachineConfig<TContext, TEvent extends EventObject> {
  id: string;
  initial: StateValue;
  context: TContext;
  on?: {
    [K in TEvent['type']]?: TransitionConfig<TContext, TEvent>;
  };
  states: {
    [key: string]: StateNodeConfig<TContext, TEvent>;
  };
}

export type MachineContext = Record<string, any>;

// Add a simple Snapshot type
export interface Snapshot<TContext, TState> {
  value: TState; // XState uses 'value' instead of 'state'
  context: TContext;
  status: 'active' | 'done' | 'error' | 'stopped';
}

// Modify ActorRef to be simpler than XState but follow similar pattern
export interface ActorRef<TContext, TEvent extends EventObject> {
  id: string;
  send: (event: TEvent) => void;
  getSnapshot: () => Snapshot<TContext, StateValue>;
  subscribe: (
    callback: (snapshot: Snapshot<TContext, StateValue>) => void
  ) => () => void;
  start: () => void;
  stop: () => void;
  matches: (stateValue: StateValue) => boolean;
  can: (event: TEvent) => boolean;
}

// Modify ActorScope to remove circular reference
export interface ActorScope<TContext, TEvent extends EventObject> {
  self: ActorRef<TContext, TEvent>; // Use ActorRef instead of Actor
  id: string;
}

export interface Guard<TContext, TEvent extends EventObject> {
  condition: (context: TContext, event: TEvent) => boolean;
}
