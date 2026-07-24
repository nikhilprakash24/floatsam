import type { FluidField } from '../FluidField';
import { ZoneField } from '../fields/ZoneField';
import { VortexField } from '../fields/VortexField';
import { RadialField } from '../fields/RadialField';
import { CapsuleField } from '../fields/CapsuleField';
import { WedgeField } from '../fields/WedgeField';
import { GradientBandField } from '../fields/GradientBandField';
import { PulsingField } from '../fields/PulsingField';
import { CenterSeekField } from '../fields/CenterSeekField';
import { TurbulenceField } from '../fields/TurbulenceField';
import { SlipstreamField } from '../fields/SlipstreamField';
import { MovingVortexField } from '../fields/MovingVortexField';
import { CompositeField } from '../fields/CompositeField';

/**
 * THE CURRENTS CATALOG — 20 named current patterns, each built from the pure
 * FluidField primitives (currents program §4). This is the single source of
 * truth shared by the Lab gallery (static-2D showcase) and the game (curated
 * subset re-expressed as scrolling cells).
 *
 * A pattern is HELPFUL (gives what the medium denies — lift/tailwind/stability)
 * or HOSTILE (taxes a budget). `scope` marks where it makes sense; `game` marks
 * how far it's cleared toward live play. Every `build` is a difficulty knob:
 * `intensity` scales the peak strength so a single dial spans easy→brutal.
 */
export type Disposition = 'helpful' | 'hostile' | 'neutral';
export type Scope = 'cell' | 'screen' | 'lab';
/** Clearance toward live play: ships as a cell · candidate · lab-only · rare event. */
export type GameStatus = 'ship' | 'candidate' | 'lab' | 'rare';

export interface CurrentKnobs {
  /** Master strength multiplier (the sandbox dial). */
  intensity: number;
}
export const DEFAULT_CATALOG_KNOBS: CurrentKnobs = { intensity: 1 };

export interface CurrentPattern {
  n: number;
  id: string;
  name: string;
  shape: string;
  disposition: Disposition;
  scope: Scope;
  game: GameStatus;
  note: string;
  /** Static-2D field for the Lab showcase, placed in the 480×720 column. */
  build: (k: CurrentKnobs) => FluidField;
}

const W = 480;
const H = 720;
/** Scale a base strength by the intensity knob. */
const s = (base: number, k: CurrentKnobs): number => base * k.intensity;

export const CURRENT_CATALOG: CurrentPattern[] = [
  {
    n: 1, id: 'updraft-vent', name: 'Updraft Vent', shape: 'rect ↑', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'A free lift column — ride it up.',
    build: (k) => new ZoneField({ shape: 'rect', x: W / 2, y: H * 0.58, halfW: 62, halfH: 210, dirX: 0, dirY: -1, strength: s(300, k), falloff: 40 }),
  },
  {
    n: 2, id: 'downwash', name: 'Downwash', shape: 'rect ↓', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'A sinking column; power through or route around.',
    build: (k) => new ZoneField({ shape: 'rect', x: W / 2, y: H * 0.42, halfW: 62, halfH: 210, dirX: 0, dirY: 1, strength: s(280, k), falloff: 40 }),
  },
  {
    n: 3, id: 'crosscut', name: 'Crosscut', shape: 'rect →', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'A lateral shove — only bites when you can move sideways.',
    build: (k) => new ZoneField({ shape: 'rect', x: W / 2, y: H / 2, halfW: 90, halfH: 120, dirX: 1, dirY: 0, strength: s(240, k), falloff: 36 }),
  },
  {
    n: 4, id: 'sidewinder', name: 'Sidewinder', shape: 'circle ↘', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'A diagonal gust that knocks your line askew.',
    build: (k) => new ZoneField({ shape: 'circle', x: W / 2, y: H / 2, radius: 140, dirX: 1, dirY: 1, strength: s(220, k), falloff: 40 }),
  },
  {
    n: 5, id: 'boil', name: 'Boil', shape: 'radial-out', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'Pushes you off its center in every direction.',
    build: (k) => new RadialField({ x: W / 2, y: H / 2, radius: 160, strength: s(200, k), falloff: 40 }),
  },
  {
    n: 6, id: 'drain', name: 'Drain', shape: 'radial-in', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'Sucks toward a point — swim outward or be pulled through.',
    build: (k) => new RadialField({ x: W / 2, y: H / 2, radius: 160, strength: s(-200, k), falloff: 40 }),
  },
  {
    n: 7, id: 'eddy-cw', name: 'Eddy (CW)', shape: 'vortex', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'A clockwise swirl; lean against the spin.',
    build: (k) => new VortexField({ x: W / 2, y: H / 2, radius: 130, strength: s(170, k), direction: -1, maxAccel: s(220, k) }),
  },
  {
    n: 8, id: 'eddy-ccw', name: 'Eddy (CCW)', shape: 'vortex', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'Its mirror — counter-clockwise.',
    build: (k) => new VortexField({ x: W / 2, y: H / 2, radius: 130, strength: s(170, k), direction: 1, maxAccel: s(220, k) }),
  },
  {
    n: 9, id: 'whirl-pair', name: 'Whirl Pair', shape: '2× vortex', disposition: 'hostile', scope: 'lab', game: 'candidate',
    note: 'Counter-rotating pair with a shear seam between them.',
    build: (k) => new CompositeField([
      new VortexField({ x: W * 0.33, y: H / 2, radius: 110, strength: s(150, k), direction: 1, maxAccel: s(200, k) }),
      new VortexField({ x: W * 0.67, y: H / 2, radius: 110, strength: s(150, k), direction: -1, maxAccel: s(200, k) }),
    ]),
  },
  {
    n: 10, id: 'gyre', name: 'Gyre', shape: 'large vortex', disposition: 'neutral', scope: 'lab', game: 'lab',
    note: 'Slow ocean-scale rotation; ambience more than obstacle.',
    build: (k) => new VortexField({ x: W / 2, y: H / 2, radius: 320, strength: s(90, k), direction: 1, maxAccel: s(120, k) }),
  },
  {
    n: 11, id: 'tailwind-lane', name: 'Tailwind Lane', shape: 'capsule →', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'A depth band that carries you forward — ride it.',
    build: (k) => new CapsuleField({ x: W / 2, y: H * 0.4, halfLen: 200, angle: 0, radius: 58, dirX: 1, dirY: 0, strength: s(200, k), falloff: 34 }),
  },
  {
    n: 12, id: 'headwind-lane', name: 'Headwind Lane', shape: 'capsule ←', disposition: 'hostile', scope: 'cell', game: 'ship',
    note: 'The toll lane; costs forward budget to cross.',
    build: (k) => new CapsuleField({ x: W / 2, y: H * 0.6, halfLen: 200, angle: 0, radius: 58, dirX: -1, dirY: 0, strength: s(200, k), falloff: 34 }),
  },
  {
    n: 13, id: 'shear-step', name: 'Shear Step', shape: 'gradient band', disposition: 'hostile', scope: 'cell', game: 'candidate',
    note: 'Cross the line where the flow flips against you.',
    build: (k) => new GradientBandField({ x: W / 2, y: H / 2, halfW: W / 2, halfH: 150, strength: s(220, k), falloff: 34 }),
  },
  {
    n: 14, id: 'geyser', name: 'Geyser', shape: 'pulsing rect ↑', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'Lift, but only on the beat — time the breath.',
    build: (k) => new PulsingField(
      new ZoneField({ shape: 'rect', x: W / 2, y: H - 200, halfW: 52, halfH: 220, dirX: 0, dirY: -1, strength: s(320, k), falloff: 34 }),
      2.4, 2,
    ),
  },
  {
    n: 15, id: 'breathing-wall', name: 'Breathing Wall', shape: 'pulsing rect', disposition: 'hostile', scope: 'cell', game: 'candidate',
    note: 'An on/off barrier of force you must time through.',
    build: (k) => new PulsingField(
      new ZoneField({ shape: 'rect', x: W / 2, y: H / 2, halfW: 70, halfH: 200, dirX: 0, dirY: 1, strength: s(300, k), falloff: 30 }),
      2.0, 4,
    ),
  },
  {
    n: 16, id: 'slipstream', name: 'Slipstream Pocket', shape: 'travelling capsule', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'A moving tailwind bubble — catch it and fly.',
    build: (k) => new SlipstreamField(s(240, k), 130, 85),
  },
  {
    n: 17, id: 'roaming-eddy', name: 'Roaming Eddy', shape: 'travelling vortex', disposition: 'hostile', scope: 'cell', game: 'candidate',
    note: 'A vortex that wanders across your path.',
    build: (k) => new MovingVortexField(120, s(160, k), -1, s(210, k), 70),
  },
  {
    n: 18, id: 'calm-eye', name: 'Calm Eye', shape: 'center-seek', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'A stabilized safe pocket in rough water.',
    build: (k) => new CenterSeekField(H / 2, 0.9 * k.intensity, s(130, k)),
  },
  {
    n: 19, id: 'launch-ramp', name: 'Launch Ramp', shape: 'wedge ↑', disposition: 'helpful', scope: 'cell', game: 'ship',
    note: 'Lift that ramps up along its length — build speed.',
    build: (k) => new WedgeField({ x: W / 2, y: H * 0.55, halfW: 150, halfH: 150, rampAxis: 'x', rampDir: 1, dirX: 0, dirY: -1, strength: s(300, k), falloff: 34 }),
  },
  {
    n: 20, id: 'the-surge', name: 'The Surge', shape: 'whole-screen', disposition: 'hostile', scope: 'screen', game: 'rare',
    note: 'RARE storm: the whole column heaves at once. Punctuation, not grammar.',
    build: (k) => new CompositeField([
      new TurbulenceField(s(90, k), 110, 23),
      new ZoneField({ shape: 'rect', x: W / 2, y: H / 2, halfW: W / 2, halfH: H / 2, dirX: 0.3, dirY: 1, strength: s(120, k), falloff: 40 }),
    ]),
  },
];

/** Patterns cleared to ship into live play as scrolling cells. */
export const SHIPPING_PATTERNS = CURRENT_CATALOG.filter((p) => p.game === 'ship');

export function patternById(id: string): CurrentPattern {
  const p = CURRENT_CATALOG.find((c) => c.id === id);
  if (!p) throw new Error(`unknown current pattern: ${id}`);
  return p;
}
