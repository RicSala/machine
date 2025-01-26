# Simple State Machine

A lightweight, educational implementation of finite state machines in TypeScript, inspired by XState v5. This library is designed to help developers understand the core principles of state machines while providing a stepping stone towards using XState in production.

## Why This Library?

While XState is an incredibly powerful state management solution, its extensive feature set can be overwhelming when you're just getting started with state machines. This library:

- Focuses on core state machine concepts
- Provides a similar API to XState v5
- Is lightweight and easy to understand
- Includes detailed documentation and examples
- Serves as a learning tool

## Installation

````bash
# Using pnpm (recommended)
pnpm add @tinystack/machine

# Using npm
npm install @tinystack/machine

# Using yarn
yarn add @tinystack/machine


# Basic Usage

```javascript
import { StateMachine, assign } from '@tinystack/machine';

// Define your machine
const toggleMachine = new StateMachine({
  initial: 'inactive',
  context: {
    count: 0
  },
  states: {
    inactive: {
      on: {
        TOGGLE: 'active'
      }
    },
    active: {
      on: {
        TOGGLE: 'inactive',
        INCREMENT: {
          actions: assign((context) => ({
            count: context.count + 1
          }))
        }
      }
    }
  }
});

// Create and start an actor
const actor = toggleMachine.createActor();
actor.start();

// Subscribe to state changes
actor.subscribe((snapshot) => {
  console.log('Current state:', snapshot.value);
  console.log('Context:', snapshot.context);
});

// Send events
actor.send({ type: 'TOGGLE' });
actor.send({ type: 'INCREMENT' });
````

## Key Concepts

### State Machines

A state machine is a model that describes all the possible states of your application and the ways it can transition between them. This makes your application's behavior predictable and easier to understand.

### Actors

Actors are the running instances of your state machines. They can:

- Receive events
- Execute actions
- Maintain their own context
- Notify subscribers of changes

### Actions

Actions are side effects that occur during state transitions. The most common action is ⁠assign, which updates the machine's context:

```javascript
const counterMachine = new StateMachine({
  initial: 'active',
  context: { count: 0 },
  states: {
    active: {
      on: {
        INCREMENT: {
          actions: assign((context) => ({
            count: context.count + 1,
          })),
        },
      },
    },
  },
});
```

### Guards

Guards are conditions that must be met for a transition to occur:

```javascript
const machine = new StateMachine({
  initial: 'locked',
  context: { coins: 0 },
  states: {
    locked: {
      on: {
        INSERT_COIN: {
          target: 'unlocked',
          guards: [
            {
              condition: (context) => context.coins >= 3,
            },
          ],
        },
      },
    },
    unlocked: {
      // ...
    },
  },
});
```

## Differences from XState v5

This library implements a subset of XState's features, focusing on the most important concepts:

✅ Included:

- Basic state transitions
- Context management
- Actions (including assign)
- Guards
- Event handling
- State subscription
- Snapshot caching

❌ Not included (available in XState):

- Actors system
- Invoked services
- Delayed transitions
- Parallel states
- History states
- State visualization
- Development tools

## When to Use This Library vs XState

Use this library when:

- Learning state machine concepts
- Building simple state-driven applications
- Teaching others about state machines
- Prototyping before moving to XState

Use XState when:

- Building production applications
- Needing advanced features
- Requiring visualization tools
- Working with complex state orchestration
- Needing actor model capabilities

## Contributing

Contributions are welcome! This library aims to be educational, so we prioritize:

- Clear, well-documented code
- Simple, focused features
- Educational examples
- Good test coverage

## License

MIT

## Acknowledgments

This library is inspired by XState and serves as an educational tool for understanding its concepts. Special thanks to the XState team for their excellent work in making state machines accessible to the JavaScript community.
