import sealJson from '../../config/characters/seal.json';
import type { FluidPhysicsConfig } from '../fluid/FluidBody';

/**
 * A character = one data profile (ARCHITECTURE v3.3 §3.2): scale factors on the
 * mode's base tuning plus an absolute hitbox. Pure data — a new creature is
 * JSON + sprites with zero engine work. Adding one must not touch FluidBody,
 * the Game loop, or locked Classic files.
 */
export interface CharacterProfile {
  id: string;
  name: string;
  /** Integrator divides continuous-force acceleration by this (ADR-006). */
  massScale: number;
  /** Scales swim/thrust impulse — "flapping power". */
  thrustScale: number;
  /** Scales the drag coefficient. */
  dragScale: number;
  /** Scales buoyancy acceleration. */
  buoyancyScale: number;
  /** Absolute collision radius (replaces the shipped r×0.8 rule). */
  hitboxRadius: number;
}

/** Effective continuous-force config for one (mode × character) pair. */
export interface EffectivePhysics extends FluidPhysicsConfig {
  massScale: number;
  hitboxRadius: number;
}

/**
 * Pure derivation: mode base × character profile → effective constants
 * (§3.2). The single source of truth for what the integrator, field and input
 * policy consume; logged to PHYSICS_SPEC.md by script, never hand-maintained.
 *
 * Seal invariant: all scales are 1.0, and `base * 1.0 === base` exactly in
 * IEEE754, so the Seal's effective integrator config is bit-identical to the
 * mode base — the foundation of the P6 step-2 bit-identical gate.
 */
export function deriveEffective(base: FluidPhysicsConfig, c: CharacterProfile): EffectivePhysics {
  return {
    gravity: base.gravity,
    buoyancyAccel: base.buoyancyAccel * c.buoyancyScale,
    dragCoefficient: base.dragCoefficient * c.dragScale,
    swimImpulse: base.swimImpulse * c.thrustScale,
    swimBlendSteps: base.swimBlendSteps,
    maxRiseSpeed: base.maxRiseSpeed,
    maxSinkSpeed: base.maxSinkSpeed,
    fixedStep: base.fixedStep,
    massScale: c.massScale,
    hitboxRadius: c.hitboxRadius,
  };
}

export const SEAL: CharacterProfile = sealJson;
