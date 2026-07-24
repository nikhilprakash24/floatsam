import fableJson from '../../../config/fable-currents.json';
import diveJson from '../../../config/modes/dive.json';
import { OTTER } from '../../character/CharacterProfile';
import type { FluidField, Vec2 } from '../FluidField';
import { ZoneField } from './ZoneField';
import { CompositeField } from './CompositeField';
import { PulsingField } from './PulsingField';
import { TurbulenceField } from './TurbulenceField';
import { LaneField } from './LaneField';
import { CenterSeekField } from './CenterSeekField';
import { BudgetClampField } from './BudgetClampField';
import { SlipstreamField } from './SlipstreamField';

/**
 * FABLE CURRENTS — currents designed as a *difficulty instrument*, not scenery.
 *
 * The thesis: a current is either HELPFUL (gives you something the medium
 * denies — lift, a tailwind, stability) or HOSTILE (taxes your budgets —
 * headwinds, chaos, mistimeable jets). Difficulty becomes a continuous dial:
 *
 *   effective = intensity × (helpful × (1 − 0.6·assistBias)
 *                          + hostile × (1 + 0.6·assistBias))
 *
 * assistBias −1 → a kind ocean (easing knob); +1 → a spiteful one. Everything
 * passes through BudgetClampField, so even intensity 1.5 stays escapable by
 * the weakest creature (§3.5 invariant enforced at runtime, not by trust).
 */
export interface FableKnobs {
  intensity: number;
  assistBias: number;
  turbulence: number;
  pulsePeriod: number;
  lungeSynergy: number;
}

export const DEFAULT_KNOBS: FableKnobs = fableJson.knobs;
export const KNOB_RANGES = fableJson.ranges;

const W = 480;
const H = 720;

// §3.5 budgets anchored to the weakest creature (Otter).
const T_UP = diveJson.biaxial.thrustUp * OTTER.thrustScale;
const T_DOWN = diveJson.biaxial.thrustDown * OTTER.thrustScale;
const BUD = fableJson.budgets;

/** Scale a field's output by a factor (for bias/intensity mixing). */
class ScaledField implements FluidField {
  constructor(
    private readonly child: FluidField,
    private readonly k: number,
  ) {}
  sampleForce(x: number, y: number, t: number): Vec2 {
    const f = this.child.sampleForce(x, y, t);
    return { x: f.x * this.k, y: f.y * this.k };
  }
}

export interface FablePreset {
  id: string;
  name: string;
  note: string;
  build: (k: FableKnobs) => FluidField;
}

function mix(helpful: FluidField[], hostile: FluidField[], k: FableKnobs): FluidField {
  const helpK = k.intensity * (1 - 0.6 * k.assistBias);
  const hostK = k.intensity * (1 + 0.6 * k.assistBias);
  const composite = new CompositeField([
    ...helpful.map((f) => new ScaledField(f, helpK)),
    ...hostile.map((f) => new ScaledField(f, hostK)),
  ]);
  return new BudgetClampField(composite, T_UP * BUD.upFrac, T_DOWN * BUD.downFrac, T_UP * BUD.latFrac);
}

export const FABLE_PRESETS: FablePreset[] = [
  {
    id: 'thermal-vents',
    name: 'Thermal Vents',
    note: 'Pulsing up-jets from the seabed. Free lift — if you time the breath.',
    build: (k) =>
      mix(
        [120, 260, 400].map(
          (x, i) =>
            new PulsingField(
              new ZoneField({ shape: 'rect', x, y: H - 200, halfW: 46, halfH: 220, dirX: 0, dirY: -1, strength: 300, falloff: 34 }),
              k.pulsePeriod * (1 + i * 0.25),
              2,
            ),
        ),
        [new TurbulenceField(k.turbulence * 0.4, 110, 3)],
        k,
      ),
  },
  {
    id: 'undertow-lanes',
    name: 'Undertow Lanes',
    note: 'Depth picks your headwind. Ride a tailwind lane or pay the toll.',
    build: (k) =>
      mix(
        [new CenterSeekField(H / 2, 0.25, 60)],
        [new LaneField(170, 175), new TurbulenceField(k.turbulence * 0.5, 120, 11)],
        k,
      ),
  },
  {
    id: 'the-churn',
    name: 'The Churn',
    note: 'Pure chaos texture. The turbulence knob is the whole game here.',
    build: (k) => mix([], [new TurbulenceField(Math.max(20, k.turbulence * 1.6), 90, 23), new LaneField(60, 240, 1.2)], k),
  },
  {
    id: 'slipstream',
    name: 'Slipstream',
    note: 'A travelling tailwind pocket. Catch it and a Power Dive flies.',
    build: (k) =>
      mix(
        [new SlipstreamField(240, 130, 85)],
        [new LaneField(90, 200, 0.6), new TurbulenceField(k.turbulence * 0.3, 130, 5)],
        k,
      ),
  },
  {
    id: 'breather',
    name: 'Breather',
    note: 'The kind ocean: a stabilizer that herds you home. Pure ease.',
    build: (k) =>
      mix(
        [new CenterSeekField(H * 0.45, 0.9, 130), new PulsingField(new ZoneField({ shape: 'rect', x: W / 2, y: H / 2, halfW: W / 2, halfH: H / 2, dirX: 0, dirY: -1, strength: 60, falloff: 40 }), k.pulsePeriod * 2, 1.5, 0.3)],
        [],
        k,
      ),
  },
];
