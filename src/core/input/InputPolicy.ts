import type { Thrust } from '../fluid/FluidBody';

/**
 * Translates player input into a per-step thrust Δv, owning whatever internal
 * state that requires (impulse reservoir, thrust ramp). A GameMode supplies one
 * (ARCHITECTURE v3.3 §3.3). Two kinds of input surface coexist behind one
 * interface: discrete `press()` (Classic tap) and continuous `setHold()`
 * (Dive/Lab up-down). A policy ignores whichever it does not use.
 */
export interface InputPolicy {
  /** Discrete press for this step (Classic). No-op for hold-based policies. */
  press(): void;
  /** Held intent for the upcoming step (BiAxial). No-op for tap-based policies. */
  setHold(up: boolean, down: boolean): void;
  /** Compute this fixed step's thrust Δv and advance internal state. */
  step(dt: number): Thrust;
  /** Current impulse reservoir, for telemetry/replay observability (0 if N/A). */
  reservoir(): number;
  reset(): void;
}
