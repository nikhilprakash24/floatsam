import type { FluidField } from './FluidField';

/** All values are accelerations (mass normalized to 1) — see PHYSICS_SPEC.md. */
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

export interface FluidBodyState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Upward Δv still to be applied, drained over swimBlendSteps. */
  pendingImpulse: number;
}

export function createBody(x: number, y: number): FluidBodyState {
  return { x, y, vx: 0, vy: 0, pendingImpulse: 0 };
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
 * Queue a tap. The impulse is NOT an instant velocity set — it drains over
 * swimBlendSteps fixed steps so momentum carries through (§4.1).
 * Re-tapping tops the reservoir up rather than stacking unboundedly.
 */
export function applySwimImpulse(body: FluidBodyState, cfg: FluidPhysicsConfig): FluidBodyState {
  return { ...body, pendingImpulse: Math.max(body.pendingImpulse, cfg.swimImpulse) };
}

/**
 * Advance one fixed step (semi-implicit Euler). Pure: returns a new state.
 */
export function stepBody(
  body: FluidBodyState,
  cfg: FluidPhysicsConfig,
  field: FluidField,
  t: number,
): FluidBodyState {
  const dt = cfg.fixedStep;
  const fieldForce = field.sampleForce(body.x, body.y, t);

  const swimDv = Math.min(body.pendingImpulse, cfg.swimImpulse / cfg.swimBlendSteps);

  const ay = cfg.gravity + fieldForce.y + dragAccel(body.vy, cfg.dragCoefficient);
  const ax = fieldForce.x + dragAccel(body.vx, cfg.dragCoefficient);

  let vy = body.vy + ay * dt - swimDv;
  let vx = body.vx + ax * dt;

  // Asymmetric terminal clamps: rising (vy < 0) vs sinking (vy > 0).
  if (vy < -cfg.maxRiseSpeed) vy = -cfg.maxRiseSpeed;
  if (vy > cfg.maxSinkSpeed) vy = cfg.maxSinkSpeed;

  return {
    x: body.x + vx * dt,
    y: body.y + vy * dt,
    vx,
    vy,
    pendingImpulse: body.pendingImpulse - swimDv,
  };
}
