import type { GameMode } from './GameMode';
import { CLASSIC_MODE } from './classicMode';
import { DIVE_MODE } from './diveMode';
import { POWER_DIVE_MODE } from './powerDiveMode';

/** Public, store-shipped modes. Currents Lab is dev-flag-gated, not listed. */
export const MODES: readonly GameMode[] = [CLASSIC_MODE, DIVE_MODE, POWER_DIVE_MODE];

export function modeById(id: string | null | undefined): GameMode {
  return MODES.find((m) => m.id === id) ?? CLASSIC_MODE;
}
