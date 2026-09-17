// M2 procedural stage-theme palettes (design v0.2 §6/§9).
// Pure data: the renderer picks one drawing routine per visualTheme.
// All motifs stay dark behind bullets. Temporary draft values.
import type { StageVisualId } from '../content/data.js';

export interface ThemePalette {
  sky: number;
  ground: number;
  accent: number;
  motif: string;
}

const PALETTES: Record<StageVisualId, ThemePalette> = {
  mist: { sky: 0x141126, ground: 0x0a0916, accent: 0xffd98a, motif: 'torii' },
  cedar: { sky: 0x0d1a12, ground: 0x070d08, accent: 0xffb04a, motif: 'lanterns' },
  river: { sky: 0x0e1a26, ground: 0x060d16, accent: 0x9adcff, motif: 'streams' },
  forge: { sky: 0x1e100e, ground: 0x0e0705, accent: 0xff5f3a, motif: 'furnace' },
  inverted: { sky: 0x1a0e24, ground: 0x0d0616, accent: 0xd88aff, motif: 'mirrored' },
  seal: { sky: 0x101020, ground: 0x05050e, accent: 0xf2ecd8, motif: 'rings' },
};

export function themePalette(id: StageVisualId): ThemePalette {
  const p = PALETTES[id];
  if (!p) throw new Error(`unknown theme ${id}`);
  return p;
}
