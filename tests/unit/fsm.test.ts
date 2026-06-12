import { describe, expect, it } from 'vitest';
import { canTransition, transition } from '../../src/core/state/fsm';

describe('game FSM', () => {
  it('allows the canonical loop BOOT→MENU→PLAY→DEAD→GAMEOVER→PLAY', () => {
    expect(transition('BOOT', 'MENU')).toBe('MENU');
    expect(transition('MENU', 'PLAY')).toBe('PLAY');
    expect(transition('PLAY', 'DEAD')).toBe('DEAD');
    expect(transition('DEAD', 'GAMEOVER')).toBe('GAMEOVER');
    expect(transition('GAMEOVER', 'PLAY')).toBe('PLAY');
    expect(transition('GAMEOVER', 'MENU')).toBe('MENU');
  });

  it('rejects illegal transitions', () => {
    expect(canTransition('BOOT', 'PLAY')).toBe(false);
    expect(canTransition('MENU', 'DEAD')).toBe(false);
    expect(canTransition('PLAY', 'MENU')).toBe(false);
    expect(canTransition('DEAD', 'PLAY')).toBe(false);
    expect(() => transition('PLAY', 'GAMEOVER')).toThrow();
  });
});
