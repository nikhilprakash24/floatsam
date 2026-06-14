import { describe, expect, it } from 'vitest';
import dive from '../../src/config/modes/dive.json';
import { LAB_PRESETS, buildPresetField } from '../../src/core/fluid/fields/presets';
import { OTTER } from '../../src/core/character/CharacterProfile';

// Field-safety invariants anchored to the weakest rostered character (Otter),
// ARCHITECTURE v3.3 §3.5: fair for the Otter ⇒ fair for everyone.
const T_UP = dive.biaxial.thrustUp * OTTER.thrustScale;
const T_DOWN = dive.biaxial.thrustDown * OTTER.thrustScale;
const UP_LIMIT = 0.8 * T_UP; // up/lateral field accel ≤ 0.8 × weakest T_up
const DOWN_LIMIT = 0.5 * T_DOWN; // down field accel ≤ 0.5 × weakest T_down (scarce)

describe('Currents Lab presets', () => {
  it('ships at least 4 presets including a downcurrent stress preset', () => {
    expect(LAB_PRESETS.length).toBeGreaterThanOrEqual(4);
    expect(LAB_PRESETS.some((p) => /riptide|downcurrent/i.test(p.id + p.name))).toBe(true);
  });

  it('every preset respects the Otter-anchored asymmetric field invariants', () => {
    for (const preset of LAB_PRESETS) {
      const field = buildPresetField(preset);
      let maxDown = 0;
      let maxUp = 0;
      let maxLat = 0;
      // Dense grid over the whole 480×720 play area.
      for (let x = 0; x <= 480; x += 16) {
        for (let y = 0; y <= 720; y += 16) {
          const f = field.sampleForce(x, y, 0);
          maxDown = Math.max(maxDown, f.y); // +y is down
          maxUp = Math.max(maxUp, -f.y);
          maxLat = Math.max(maxLat, Math.abs(f.x));
        }
      }
      expect(maxDown, `${preset.id} down`).toBeLessThanOrEqual(DOWN_LIMIT + 1e-6);
      expect(maxUp, `${preset.id} up`).toBeLessThanOrEqual(UP_LIMIT + 1e-6);
      expect(maxLat, `${preset.id} lateral`).toBeLessThanOrEqual(UP_LIMIT + 1e-6);
    }
  });

  it('the riptide preset genuinely stresses the down budget (>70% of the limit)', () => {
    const riptide = LAB_PRESETS.find((p) => /riptide/i.test(p.id))!;
    const field = buildPresetField(riptide);
    let maxDown = 0;
    for (let x = 0; x <= 480; x += 16) {
      for (let y = 0; y <= 720; y += 16) {
        maxDown = Math.max(maxDown, field.sampleForce(x, y, 0).y);
      }
    }
    expect(maxDown).toBeGreaterThan(0.7 * DOWN_LIMIT);
  });
});
