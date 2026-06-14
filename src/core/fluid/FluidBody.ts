import type { FluidField } from './FluidField';

/**
 * Continuous-force tuning, expressed as accelerations (see PHYSICS_SPEC.md).
 * `swimImpulse`/`swimBlendSteps` are consumed by TapUpPolicy, not the
 * integrator; they stay here so a single effective-config object threads
 * through mode + character derivation.
 */
export interface FluidPhysicsConfig {
  gravity: number;
  buoyancyAccel: number;
  dragCoefficient: number;
  swimImpulse: number;
  swimBlendSteps: number;
  maxRiseSpeed: number;
  maxSinkSpeed: number;
  fixedStep: number;
}

/** Pure kinematic state. Input/reservoir state lives in the InputPolicy. */
export interface FluidBodyState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** A per-step velocity delta contributed by an input policy (thrust/impulse). */
export interface Thrust {
  dvx: number;
  dvy: number;
}

export const ZERO_THRUST: Thrust = { dvx: 0, dvy: 0 };

export function createBody(x: number, y: number): FluidBodyState {
  return { x, y, vx: 0, vy: 0 };
}

/** Quadratic drag: -c · v · |v|. Opposes motion, grows with speed². */
export function dragAccel(v: number, dragCoefficient: number): number {
  return -dragCoefficient * v * Math.abs(v);
}

/** Terminal speed for a constant driving acceleration against quadratic drag. */
export function terminalSpeed(drivingAccel: number, dragCoefficient: number): number {
  return Math.sqrt(Math.abs(drivingAccel) / dragCoefficient);
}

/**
 * The ONE integrator (ARCHITECTURE v3.3 §3.1 rule 4), semi-implicit Euler,
 * one fixed step. Continuous forces (gravity, buoyancy, field, drag) become an
 * acceleration divided by `massScale` (ADR-006); `thrust` is a direct velocity
 * delta (NOT mass-scaled — it is already a Δv). Pure: returns a new state.
 *
 * Bit-identity for Classic(Seal): massScale = 1 and thrust = (0, -swimDv) make
 * this arithmetically equal to the shipped formula, since X/1===X and
 * v + a·dt + (−s) === v + a·dt − s exactly in IEEE754.
 */
export function stepBody(
  body: FluidBodyState,
  cfg: FluidPhysicsConfig,
  field: FluidField,
  t: number,
  thrust: Thrust = ZERO_THRUST,
  massScale = 1,
): FluidBodyState {
  const dt = cfg.fixedStep;
  const fieldForce = field.sampleForce(body.x, body.y, t);

  const ay = (cfg.gravity + fieldForce.y + dragAccel(body.vy, cfg.dragCoefficient)) / massScale;
  const ax = (fieldForce.x + dragAccel(body.vx, cfg.dragCoefficient)) / massScale;

  let vy = body.vy + ay * dt + thrust.dvy;
  let vx = body.vx + ax * dt + thrust.dvx;

  // Asymmetric terminal clamps: rising (vy < 0) vs sinking (vy > 0).
  if (vy < -cfg.maxRiseSpeed) vy = -cfg.maxRiseSpeed;
  if (vy > cfg.maxSinkSpeed) vy = cfg.maxSinkSpeed;

  return {
    x: body.x + vx * dt,
    y: body.y + vy * dt,
    vx,
    vy,
  };
}
