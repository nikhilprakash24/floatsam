import { describe, expect, it } from 'vitest';
import { circleRectOverlap } from '../../src/core/sim/Simulation';
import { DIFFICULTY, PHYSICS, makeClassicSealSim } from '../helpers';

describe('circleRectOverlap precision', () => {
  it('detects overlap on edges and corners', () => {
    // Circle touching rect's left edge from outside (just inside threshold).
    expect(circleRectOverlap(95, 50, 10, 100, 0, 50, 100)).toBe(true);
    // Exactly tangent → not overlapping (strict inequality).
    expect(circleRectOverlap(90, 50, 10, 100, 0, 50, 100)).toBe(false);
    // Corner case: diagonal distance just under the radius.
    expect(circleRectOverlap(94, -6, 10, 100, 0, 50, 100)).toBe(true);
    expect(circleRectOverlap(85, -15, 10, 100, 0, 50, 100)).toBe(false);
    // Fully inside.
    expect(circleRectOverlap(125, 50, 10, 100, 0, 50, 100)).toBe(true);
  });
});

describe('Simulation death conditions', () => {
  it('dies on the seabed when never tapping', () => {
    // Push the first gate far away so the seabed is the only hazard.
    const sim = makeClassicSealSim(42, undefined, { firstGateX: 50_000 });
    let frames = 0;
    while (sim.phase === 'PLAY' && frames < 60 * 30) {
      sim.tick();
      frames++;
    }
    expect(sim.phase).toBe('DEAD');
    expect(sim.body.y + sim.hitboxRadius).toBeGreaterThanOrEqual(DIFFICULTY.worldHeight - 5);
  });

  it('hitbox is tighter than the sprite (~80%)', () => {
    const sim = makeClassicSealSim(1);
    expect(sim.hitboxRadius).toBeCloseTo(
      DIFFICULTY.playerRadius * PHYSICS.playerHitboxScale,
      10,
    );
    expect(sim.hitboxRadius).toBeLessThan(DIFFICULTY.playerRadius);
  });

  it('death transitions PLAY→DEAD→OVER with the slow-mo beat (~300 ms real time)', () => {
    const sim = makeClassicSealSim(42);
    while (sim.phase === 'PLAY') sim.tick();
    expect(sim.phase).toBe('DEAD');
    sim.advance(DIFFICULTY.deathSlowmoMs - 50);
    expect(sim.phase).toBe('DEAD');
    sim.advance(60);
    expect(sim.phase).toBe('OVER');
  });

  it('taps are ignored once dead', () => {
    const sim = makeClassicSealSim(42);
    while (sim.phase === 'PLAY') sim.tick();
    const vyAtDeath = sim.body.vy;
    sim.tap();
    sim.tick();
    expect(sim.pendingImpulse).toBe(0);
    expect(sim.body.vy).toBeGreaterThanOrEqual(Math.min(vyAtDeath, 0));
  });
});
