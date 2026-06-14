import { describe, expect, it } from 'vitest';
import { CLASSIC_MODE } from '../../src/core/modes/classicMode';
import { DIVE_MODE } from '../../src/core/modes/diveMode';
import { POWER_DIVE_MODE } from '../../src/core/modes/powerDiveMode';
import { CHARACTERS, SEAL } from '../../src/core/character/CharacterProfile';
import { runPair } from './fairness-harness';

/**
 * The G6 fairness matrix (ARCHITECTURE v3.3 §4.3): every (mode × character)
 * pair must be clearable by a simple reference bot — fair by construction via
 * clampsFor()/gapScaleFor(). The committed suite runs a strong continuous count
 * per pair; the full 10k-per-pair sweep is recorded in DECISIONS.md (G6).
 */
const SEEDS = 1500;
const GATES = 15;

describe('fairness matrix — every (mode × character) pair is clearable', () => {
  for (const mode of [CLASSIC_MODE, DIVE_MODE]) {
    for (const char of CHARACTERS) {
      it(
        `${mode.id} × ${char.id}: ${SEEDS} seeds each clear ${GATES} gates`,
        { timeout: 120_000 },
        () => {
          const r = runPair(mode, char, SEEDS, GATES);
          expect(r.failures, `worst run only reached ${r.minScore}/${GATES}`).toBe(0);
        },
      );
    }
  }
});

/**
 * Power Dive is a deliberately ADVANCED mode: a dive lunges forward, coupling
 * descent to horizontal motion, so a naive bang-bang bot occasionally traps
 * itself. We hold it to a "broadly fair" bar (≥99% of seeds clearable) rather
 * than the strict 0-failure bar of the core modes (ADR-013).
 */
describe('Power Dive (advanced) — broadly fair', () => {
  for (const char of CHARACTERS) {
    it(`powerdive × ${char.id}: ≥99% of 1500 seeds clear ${GATES}`, { timeout: 120_000 }, () => {
      const r = runPair(POWER_DIVE_MODE, char, 1500, GATES);
      expect(r.failures, `min score ${r.minScore}`).toBeLessThanOrEqual(15); // ≤1%
    });
  }
});

describe('pace wrapper stays fair at +20% (Faster)', () => {
  it('Classic(Seal) clears at Faster tempo', { timeout: 60_000 }, () => {
    expect(runPair(CLASSIC_MODE, SEAL, 1000, GATES, 1.2).failures).toBe(0);
  });
  it('Dive(Seal) clears at Faster tempo', { timeout: 60_000 }, () => {
    expect(runPair(DIVE_MODE, SEAL, 1000, GATES, 1.2).failures).toBe(0);
  });
});
