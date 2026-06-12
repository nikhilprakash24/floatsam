import { describe, expect, it } from 'vitest';
import { collectPassedGates } from '../../src/core/score/score';
import type { Gate } from '../../src/core/spawn/Spawner';

function gate(x: number, scored = false): Gate {
  return { id: 0, x, gapCenterY: 360, gapSize: 200, scored };
}

describe('collectPassedGates', () => {
  it('scores a gate once its trailing edge passes the player', () => {
    const gates = [gate(100)];
    expect(collectPassedGates(gates, 140, 70)).toBe(1);
    expect(gates[0]!.scored).toBe(true);
  });

  it('does not score a gate still overlapping the player', () => {
    const gates = [gate(120)];
    expect(collectPassedGates(gates, 140, 70)).toBe(0);
  });

  it('never double-counts', () => {
    const gates = [gate(100)];
    collectPassedGates(gates, 140, 70);
    expect(collectPassedGates(gates, 140, 70)).toBe(0);
  });

  it('counts multiple passes in one sweep', () => {
    const gates = [gate(10), gate(80), gate(300)];
    expect(collectPassedGates(gates, 140, 70)).toBe(2);
  });
});
