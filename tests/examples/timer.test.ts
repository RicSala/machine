import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StateMachine } from '../../src/StateMachine';
import { assign } from '../../src/actions';
import { MachineConfig } from '../../src/types';

interface TimerContext {
  duration: number;
  elapsed: number;
  interval: number | null;
}

type TimerEvent =
  | { type: 'INITIALIZE'; duration: number }
  | { type: 'START' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'TICK' };

describe('Timer Example', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should create a timer machine and handle timer events correctly', () => {
    const timerConfig: MachineConfig<TimerContext, TimerEvent> = {
      id: 'timer',
      initial: 'idle',
      context: {
        duration: 0,
        elapsed: 0,
        interval: null,
      },
      states: {
        idle: {
          on: {
            INITIALIZE: {
              target: 'ready',
              actions: [
                assign<TimerContext, TimerEvent>((context, event) => {
                  if (event.type !== 'INITIALIZE') return {};
                  return {
                    duration: event.duration,
                    elapsed: 0,
                    interval: null,
                  };
                }),
              ],
            },
          },
        },
        ready: {
          on: {
            START: {
              target: 'running',
              actions: [
                assign<TimerContext, TimerEvent>(() => ({
                  interval: setInterval(() => {
                    // This will be mocked in tests
                  }, 1000) as unknown as number,
                })),
              ],
            },
          },
        },
        running: {
          on: {
            PAUSE: {
              target: 'paused',
              actions: [
                assign<TimerContext, TimerEvent>((context) => {
                  clearInterval(context.interval!);
                  return { interval: null };
                }),
              ],
            },
            TICK: {
              actions: [
                assign<TimerContext, TimerEvent>((context) => ({
                  elapsed: context.elapsed + 1,
                })),
              ],
              guards: [
                {
                  type: 'notCompleted',
                  condition: (context: TimerContext) =>
                    context.elapsed < context.duration,
                },
              ],
            },
          },
        },
        paused: {
          on: {
            RESUME: {
              target: 'running',
              actions: [
                assign<TimerContext, TimerEvent>(() => ({
                  interval: setInterval(() => {
                    // This will be mocked in tests
                  }, 1000) as unknown as number,
                })),
              ],
            },
          },
        },
      },
    };

    const machine = new StateMachine(timerConfig);
    const actor = machine.createActor();

    // Test initialization
    actor.send({ type: 'INITIALIZE', duration: 60 });
    expect(actor.getSnapshot().value).toBe('ready');
    expect(actor.getSnapshot().context.duration).toBe(60);
    expect(actor.getSnapshot().context.elapsed).toBe(0);

    // Test starting the timer
    actor.send({ type: 'START' });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.interval).toBeDefined();

    // Simulate time passing and ticks
    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().context.elapsed).toBe(1);

    actor.send({ type: 'TICK' });
    expect(actor.getSnapshot().context.elapsed).toBe(2);

    // Test pausing
    actor.send({ type: 'PAUSE' });
    expect(actor.getSnapshot().value).toBe('paused');
    expect(actor.getSnapshot().context.interval).toBeNull();

    // Test resuming
    actor.send({ type: 'RESUME' });
    expect(actor.getSnapshot().value).toBe('running');
    expect(actor.getSnapshot().context.interval).toBeDefined();

    // Cleanup intervals
    clearInterval(actor.getSnapshot().context.interval!);
  });

  it('should not increment elapsed time beyond duration', () => {
    const timerConfig: MachineConfig<TimerContext, TimerEvent> = {
      id: 'timer',
      initial: 'idle',
      context: {
        duration: 0,
        elapsed: 0,
        interval: null,
      },
      states: {
        idle: {
          on: {
            INITIALIZE: {
              target: 'ready',
              actions: [
                assign<TimerContext, TimerEvent>((context, event) => {
                  if (event.type !== 'INITIALIZE') return {};
                  return {
                    duration: event.duration,
                    elapsed: 0,
                    interval: null,
                  };
                }),
              ],
            },
          },
        },
        ready: {
          on: {
            START: {
              target: 'running',
              actions: [
                assign<TimerContext, TimerEvent>(() => ({
                  interval: setInterval(() => {
                    // This will be mocked in tests
                  }, 1000) as unknown as number,
                })),
              ],
            },
          },
        },
        running: {
          on: {
            TICK: {
              actions: [
                assign<TimerContext, TimerEvent>((context) => ({
                  elapsed: context.elapsed + 1,
                })),
              ],
              guards: [
                {
                  type: 'notCompleted',
                  condition: (context: TimerContext) =>
                    context.elapsed < context.duration,
                },
              ],
            },
          },
        },
      },
    };

    const machine = new StateMachine(timerConfig);
    const actor = machine.createActor();

    // Initialize with 2 seconds duration
    actor.send({ type: 'INITIALIZE', duration: 2 });
    actor.send({ type: 'START' });

    // Simulate 3 ticks (should only count up to 2)
    actor.send({ type: 'TICK' });
    actor.send({ type: 'TICK' });
    actor.send({ type: 'TICK' }); // This should be ignored due to the guard

    expect(actor.getSnapshot().context.elapsed).toBe(2);

    // Cleanup intervals
    clearInterval(actor.getSnapshot().context.interval!);
  });
});
