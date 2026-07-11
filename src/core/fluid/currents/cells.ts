import type { FluidField } from '../FluidField';
import { ZoneField } from '../fields/ZoneField';
import { VortexField } from '../fields/VortexField';
import { RadialField } from '../fields/RadialField';
import { CapsuleField } from '../fields/CapsuleField';
import { WedgeField } from '../fields/WedgeField';
import { PulsingField } from '../fields/PulsingField';

/**
 * CELL FIELDS (currents program C3). The curated, *localized* subset of the
 * catalog re-expressed for the scrolling game: each built in a LOCAL frame
 * centered at x = 0, so a CurrentSpawner can place it at any worldX and scroll
 * it left. Only spatially-bounded patterns qualify as cells — global
 * stabilizers (calm-eye) and travelling pockets (slipstream, roaming-eddy)
 * are Lab/surge material, not cells, because they aren't confined in x.
 */
export type CellKind =
  | 'updraft'
  | 'downwash'
  | 'crosscut'
  | 'sidewinder'
  | 'boil'
  | 'drain'
  | 'eddy-cw'
  | 'eddy-ccw'
  | 'tailwind'
  | 'headwind'
  | 'geyser'
  | 'launch-ramp';

export const CELL_KINDS: readonly CellKind[] = [
  'updraft', 'downwash', 'crosscut', 'sidewinder', 'boil', 'drain',
  'eddy-cw', 'eddy-ccw', 'tailwind', 'headwind', 'geyser', 'launch-ramp',
];

/** Helpful cells (give lift/tailwind) vs hostile (tax a budget). */
export const HELPFUL_KINDS: readonly CellKind[] = ['updraft', 'tailwind', 'geyser', 'launch-ramp'];

/** Horizontal footprint (px) either side of the cell center — for culling and
 *  telegraph placement. Slightly padded past the field's true reach. */
export function cellHalfWidth(kind: CellKind): number {
  switch (kind) {
    case 'tailwind':
    case 'headwind':
      return 210;
    case 'sidewinder':
    case 'boil':
    case 'drain':
    case 'eddy-cw':
    case 'eddy-ccw':
      return 135;
    case 'launch-ramp':
      return 145;
    case 'crosscut':
      return 118;
    case 'updraft':
    case 'downwash':
      return 100;
    case 'geyser':
      return 86;
  }
}

/** Build a cell's field in its local frame (center x = 0), scaled by intensity. */
export function buildCellField(kind: CellKind, centerY: number, intensity: number): FluidField {
  const s = (base: number): number => base * intensity;
  switch (kind) {
    case 'updraft':
      return new ZoneField({ shape: 'rect', x: 0, y: centerY, halfW: 60, halfH: 150, dirX: 0, dirY: -1, strength: s(300), falloff: 38 });
    case 'downwash':
      return new ZoneField({ shape: 'rect', x: 0, y: centerY, halfW: 60, halfH: 150, dirX: 0, dirY: 1, strength: s(280), falloff: 38 });
    case 'crosscut':
      return new ZoneField({ shape: 'rect', x: 0, y: centerY, halfW: 80, halfH: 110, dirX: 1, dirY: 0, strength: s(240), falloff: 34 });
    case 'sidewinder':
      return new ZoneField({ shape: 'circle', x: 0, y: centerY, radius: 120, dirX: 1, dirY: 1, strength: s(210), falloff: 38 });
    case 'boil':
      return new RadialField({ x: 0, y: centerY, radius: 130, strength: s(200), falloff: 36 });
    case 'drain':
      return new RadialField({ x: 0, y: centerY, radius: 130, strength: s(-200), falloff: 36 });
    case 'eddy-cw':
      return new VortexField({ x: 0, y: centerY, radius: 120, strength: s(160), direction: -1, maxAccel: s(210) });
    case 'eddy-ccw':
      return new VortexField({ x: 0, y: centerY, radius: 120, strength: s(160), direction: 1, maxAccel: s(210) });
    case 'tailwind':
      return new CapsuleField({ x: 0, y: centerY, halfLen: 150, angle: 0, radius: 56, dirX: 1, dirY: 0, strength: s(200), falloff: 32 });
    case 'headwind':
      return new CapsuleField({ x: 0, y: centerY, halfLen: 150, angle: 0, radius: 56, dirX: -1, dirY: 0, strength: s(200), falloff: 32 });
    case 'geyser':
      return new PulsingField(
        new ZoneField({ shape: 'rect', x: 0, y: centerY, halfW: 52, halfH: 170, dirX: 0, dirY: -1, strength: s(320), falloff: 32 }),
        2.4, 2,
      );
    case 'launch-ramp':
      return new WedgeField({ x: 0, y: centerY, halfW: 140, halfH: 130, rampAxis: 'x', rampDir: 1, dirX: 0, dirY: -1, strength: s(300), falloff: 32 });
  }
}
