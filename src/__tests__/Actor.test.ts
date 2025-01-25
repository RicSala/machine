import { describe, it, expect, vi } from 'vitest';
import { StateMachine } from '../StateMachine';
import type { MachineConfig, EventObject } from '../types';

interface TestContext {
  value: number;
}

interface TestEvents extends EventObject {
  type: 'INCREMENT' | 'STOP' | 'START';
}

const createTestMachine = () => {
  const config: MachineConfig<TestContext, TestEvents> = {
    id: 'test',
    initial: 'idle',
    context: {
      value: 0,
    },
    states: {
      idle: {
        on: {
          INCREMENT: {
            actions: [
              {
                type: 'xstate.assign',
                exec: ({ context }) => ({ value: context.value + 1 }),
              },
            ],
          },
        },
      },
    },
  };

  return new StateMachine(config);
};

describe('Actor', () => {
  it('should have a unique ID', () => {
    const machine = createTestMachine();
    const actor1 = machine.createActor();
    const actor2 = machine.createActor();

    expect(actor1.id).toBeDefined();
    expect(actor2.id).toBeDefined();
    expect(actor1.id).not.toBe(actor2.id);
  });

  it('should manage actor status correctly', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    // Initial status should be active
    expect(actor.getSnapshot().status).toBe('active');

    // Stop the actor
    actor.stop();
    expect(actor.getSnapshot().status).toBe('stopped');

    // Start the actor again
    actor.start();
    expect(actor.getSnapshot().status).toBe('active');
  });

  it('should not process events when stopped', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    // Stop the actor
    actor.stop();

    // Try to send an event
    actor.send({ type: 'INCREMENT' });

    // Context should not change
    expect(actor.getSnapshot().context.value).toBe(0);
  });

  it('should handle subscription cleanup correctly', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    const callback = vi.fn();
    const unsubscribe = actor.subscribe(callback);

    // Should be called once immediately with initial state
    expect(callback).toHaveBeenCalledTimes(1);

    // Send an event
    actor.send({ type: 'INCREMENT' });
    expect(callback).toHaveBeenCalledTimes(2);

    // Unsubscribe
    unsubscribe();

    // Send another event
    actor.send({ type: 'INCREMENT' });

    // Callback should not be called again
    expect(callback).toHaveBeenCalledTimes(2);
  });

  it('should cache snapshots correctly', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    const snapshot1 = actor.getSnapshot();
    const snapshot2 = actor.getSnapshot();

    // Same snapshot should be returned when no changes occurred
    expect(snapshot1).toBe(snapshot2);

    // After state change, should get a new snapshot
    actor.send({ type: 'INCREMENT' });
    const snapshot3 = actor.getSnapshot();

    expect(snapshot3).not.toBe(snapshot1);
    expect(snapshot3.context.value).toBe(1);
  });

  it('should implement matches correctly', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    expect(actor.matches('idle')).toBe(true);
    expect(actor.matches('nonexistent')).toBe(false);
  });

  it('should implement can correctly', () => {
    const machine = createTestMachine();
    const actor = machine.createActor();

    expect(actor.can({ type: 'INCREMENT' })).toBe(true);
    expect(actor.can({ type: 'NONEXISTENT' as any })).toBe(false);
  });
});
