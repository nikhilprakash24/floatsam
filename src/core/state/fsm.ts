export type GameState = 'BOOT' | 'MENU' | 'PLAY' | 'DEAD' | 'GAMEOVER';

const TRANSITIONS: Record<GameState, readonly GameState[]> = {
  BOOT: ['MENU'],
  MENU: ['PLAY'],
  PLAY: ['DEAD'],
  DEAD: ['GAMEOVER'],
  GAMEOVER: ['PLAY', 'MENU'],
};

export function canTransition(from: GameState, to: GameState): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Returns the new state; throws on an illegal transition so bugs surface in tests. */
export function transition(from: GameState, to: GameState): GameState {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal FSM transition: ${from} -> ${to}`);
  }
  return to;
}
