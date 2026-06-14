import { describe, expect, it } from 'vitest';
import { createBody, stepBody, type FluidBodyState } from '../../src/core/fluid/FluidBody';
import { ConstantBuoyancyField } from '../../src/core/fluid/FluidField';
import { TapUpPolicy } from '../../src/core/input/TapUpPolicy';
import { PHYSICS } from '../helpers';

const field = new ConstantBuoyancyField(PHYSICS.buoyancyAccel);
const STEP = PHYSICS.fixedStep;

/** Drive the integrator through the real Classic policy (post-refactor). */
function pilot(): { policy: TapUpPolicy; advance: (b: FluidBodyState) => FluidBodyState } {
  const policy = new TapUpPolicy(PHYSICS);
  return { policy, advance: (b) => stepBody(b, PHYSICS, field, 0, policy.step(STEP)) };
}

function settleToTerminal(): { b: FluidBodyState; p: ReturnType<typeof pilot> } {
  const p = pilot();
  let b = createBody(140, 100);
  for (let i = 0; i < 60 * 8; i++) b = p.advance(b);
  return { b, p };
}

describe('feel targets §4.2 (G1 acceptance)', () => {
  it('idle player sinks at a slow terminal velocity: 80–120 px/s', () => {
    const { b } = settleToTerminal();
    expect(b.vy).toBeGreaterThanOrEqual(80);
    expect(b.vy).toBeLessThanOrEqual(120);
  });

  it('a single tap from terminal sink arrests the fall and produces a gentle rise arc', () => {
    let { b, p } = settleToTerminal();
    const startY = b.y;
    p.policy.press();

    let peakY = startY;
    let framesToPeak = 0;
    let frames = 0;
    let prevVy = b.vy;
    let maxStepDv = 0;

    // Run until the body is sinking again (arc complete) or 3 s elapse.
    while (frames < 180) {
      b = p.advance(b);
      maxStepDv = Math.max(maxStepDv, Math.abs(b.vy - prevVy));
      prevVy = b.vy;
      frames++;
      if (b.y < peakY) {
        peakY = b.y;
        framesToPeak = frames;
      }
      if (b.vy > 0 && frames > framesToPeak + 5) break;
    }

    const riseHeight = startY - peakY;
    const timeToPeak = framesToPeak * STEP;

    // Tap arrests the sink (we actually rose)…
    expect(riseHeight).toBeGreaterThanOrEqual(40);
    // …but gently — swimmy, not rockety.
    expect(riseHeight).toBeLessThanOrEqual(120);
    expect(timeToPeak).toBeGreaterThanOrEqual(0.3);
    expect(timeToPeak).toBeLessThanOrEqual(1.0);

    // No frame of motion is instantaneous (§4.2): per-step Δv stays bounded.
    expect(maxStepDv).toBeLessThan(160);
  });

  it('double-tap chains rise without hitting the speed clamp instantly (swimmy, not rockety)', () => {
    let { b, p } = settleToTerminal();
    p.policy.press();
    for (let i = 0; i < 8; i++) b = p.advance(b);
    p.policy.press();
    for (let i = 0; i < 8; i++) b = p.advance(b);
    // Chained taps rise faster than a single tap but stay under the clamp.
    expect(b.vy).toBeLessThan(0);
    expect(b.vy).toBeGreaterThan(-PHYSICS.maxRiseSpeed);
  });

  it('momentum carries: tap blends in, velocity never snaps to the full impulse', () => {
    let { b, p } = settleToTerminal();
    const sinkVy = b.vy;
    const perStep = PHYSICS.swimImpulse / PHYSICS.swimBlendSteps;
    p.policy.press();
    b = p.advance(b);
    // One frame in: the kick has started…
    expect(b.vy).toBeLessThan(sinkVy);
    // …but only by one blended slice, not the whole impulse (no flappy snap).
    expect(b.vy).toBeGreaterThan(sinkVy - perStep - 25);
    expect(b.vy).toBeGreaterThan(-PHYSICS.swimImpulse / 2);
  });
});
