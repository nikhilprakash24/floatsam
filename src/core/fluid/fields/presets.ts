import currentsLab from '../../../config/modes/currents-lab.json';
import type { FluidField } from '../FluidField';
import { ZoneField } from './ZoneField';
import { VortexField } from './VortexField';
import { CompositeField } from './CompositeField';

export interface ZoneFieldJson {
  type: 'zone';
  shape: 'rect' | 'circle';
  x: number;
  y: number;
  halfW?: number;
  halfH?: number;
  radius?: number;
  dirX: number;
  dirY: number;
  strength: number;
  falloff: number;
}

export interface VortexFieldJson {
  type: 'vortex';
  x: number;
  y: number;
  radius: number;
  strength: number;
  direction: 1 | -1;
  inflow?: number;
  maxAccel: number;
}

export type FieldJson = ZoneFieldJson | VortexFieldJson;

export interface CurrentsPreset {
  id: string;
  name: string;
  fields: FieldJson[];
}

function makeField(cfg: FieldJson): FluidField {
  if (cfg.type === 'vortex') {
    return new VortexField({
      x: cfg.x,
      y: cfg.y,
      radius: cfg.radius,
      strength: cfg.strength,
      direction: cfg.direction,
      inflow: cfg.inflow,
      maxAccel: cfg.maxAccel,
    });
  }
  return new ZoneField({
    shape: cfg.shape,
    x: cfg.x,
    y: cfg.y,
    halfW: cfg.halfW,
    halfH: cfg.halfH,
    radius: cfg.radius,
    dirX: cfg.dirX,
    dirY: cfg.dirY,
    strength: cfg.strength,
    falloff: cfg.falloff,
  });
}

/** Compose a preset's child fields into one sampleable field (superposition). */
export function buildPresetField(preset: CurrentsPreset): FluidField {
  return new CompositeField(preset.fields.map(makeField));
}

export const LAB_PRESETS: readonly CurrentsPreset[] = currentsLab.presets as CurrentsPreset[];
