// Content data: players, stage, bosses (spec §8). Original placeholder content.
// Engine looks up by ID; no stage===1 branches in engine.
import { STAGE_ORDER as ORDER } from '../core/run.js';
import { STAGES as ALL_STAGES } from './stages.js';
import { getBoss as lookupBoss } from './bosses.js';

export interface ShotTypeDef {
  id: string;
  name: string;
  desc: string;
  // volley layout per power stage (0..4): offsets + damage mult + focused?
  streams: { dx: number; dmg: number; slightHoming: boolean }[][];
  speed: number;
  interval: number;
}

export interface PlayerDef {
  id: string;
  name: string;
  epithet: string;
  speedHi: number;
  speedLo: number;
  hitRadius: number;
  shots: ShotTypeDef[];
  bombName: string;
  bombRadius: number; // visual + clear radius (bomb always clears all here)
}

// M1 temp roster: 2 players x 2 shot types. Names/setting are placeholders.
export const PLAYERS: PlayerDef[] = [
  {
    id: 'aria',
    name: 'Aria',
    epithet: 'draft shrine keeper',
    speedHi: 3.8,
    speedLo: 1.65,
    hitRadius: 2.5,
    bombName: 'Ward Burst',
    bombRadius: 220,
    shots: [
      {
        id: 'aria-a',
        name: 'Ofuda Spread',
        desc: 'wide unfocused spread, tightens on Focus',
        speed: 11,
        interval: 6,
        streams: [
          [{ dx: 0, dmg: 1, slightHoming: false }],
          [{ dx: -6, dmg: 1, slightHoming: false }, { dx: 6, dmg: 1, slightHoming: false }],
          [{ dx: -10, dmg: 1, slightHoming: false }, { dx: 0, dmg: 1.2, slightHoming: false }, { dx: 10, dmg: 1, slightHoming: false }],
          [{ dx: -14, dmg: 1, slightHoming: false }, { dx: -5, dmg: 1.2, slightHoming: false }, { dx: 5, dmg: 1.2, slightHoming: false }, { dx: 14, dmg: 1, slightHoming: false }],
          [{ dx: -16, dmg: 1, slightHoming: false }, { dx: -8, dmg: 1.2, slightHoming: false }, { dx: 0, dmg: 1.4, slightHoming: false }, { dx: 8, dmg: 1.2, slightHoming: false }, { dx: 16, dmg: 1, slightHoming: false }],
        ],
      },
      {
        id: 'aria-b',
        name: 'Needle Bind',
        desc: 'narrow piercing stream + slight homing options',
        speed: 13,
        interval: 7,
        streams: [
          [{ dx: 0, dmg: 1.4, slightHoming: false }],
          [{ dx: -4, dmg: 1.2, slightHoming: true }, { dx: 4, dmg: 1.2, slightHoming: true }],
          [{ dx: 0, dmg: 1.6, slightHoming: false }, { dx: -8, dmg: 1, slightHoming: true }, { dx: 8, dmg: 1, slightHoming: true }],
          [{ dx: 0, dmg: 1.8, slightHoming: false }, { dx: -6, dmg: 1.2, slightHoming: true }, { dx: 6, dmg: 1.2, slightHoming: true }],
          [{ dx: 0, dmg: 2.0, slightHoming: false }, { dx: -6, dmg: 1.3, slightHoming: true }, { dx: 6, dmg: 1.3, slightHoming: true }, { dx: -12, dmg: 1, slightHoming: true }, { dx: 12, dmg: 1, slightHoming: true }],
        ],
      },
    ],
  },
  {
    id: 'rin',
    name: 'Rin',
    epithet: 'draft charm crafter',
    speedHi: 4.0,
    speedLo: 1.7,
    hitRadius: 2.5,
    bombName: 'Charm Nova',
    bombRadius: 260,
    shots: [
      {
        id: 'rin-a',
        name: 'Star Lattice',
        desc: 'even fan, Focus narrows it',
        speed: 10,
        interval: 6,
        streams: [
          [{ dx: 0, dmg: 1, slightHoming: false }],
          [{ dx: -8, dmg: 0.9, slightHoming: false }, { dx: 8, dmg: 0.9, slightHoming: false }],
          [{ dx: -12, dmg: 0.9, slightHoming: false }, { dx: 0, dmg: 1.1, slightHoming: false }, { dx: 12, dmg: 0.9, slightHoming: false }],
          [{ dx: -16, dmg: 0.9, slightHoming: false }, { dx: -6, dmg: 1, slightHoming: false }, { dx: 6, dmg: 1, slightHoming: false }, { dx: 16, dmg: 0.9, slightHoming: false }],
          [{ dx: -18, dmg: 0.9, slightHoming: false }, { dx: -9, dmg: 1, slightHoming: false }, { dx: 0, dmg: 1.2, slightHoming: false }, { dx: 9, dmg: 1, slightHoming: false }, { dx: 18, dmg: 0.9, slightHoming: false }],
        ],
      },
      {
        id: 'rin-b',
        name: 'Wisp Lantern',
        desc: 'slow heavy orbs, fewer streams',
        speed: 9,
        interval: 8,
        streams: [
          [{ dx: 0, dmg: 2.2, slightHoming: false }],
          [{ dx: 0, dmg: 2.4, slightHoming: false }],
          [{ dx: -6, dmg: 1.8, slightHoming: false }, { dx: 6, dmg: 1.8, slightHoming: false }],
          [{ dx: 0, dmg: 2.2, slightHoming: false }, { dx: -10, dmg: 1.6, slightHoming: false }, { dx: 10, dmg: 1.6, slightHoming: false }],
          [{ dx: 0, dmg: 2.4, slightHoming: false }, { dx: -8, dmg: 1.8, slightHoming: false }, { dx: 8, dmg: 1.8, slightHoming: false }, { dx: -16, dmg: 1.4, slightHoming: false }, { dx: 16, dmg: 1.4, slightHoming: false }],
        ],
      },
    ],
  },
];

export function getPlayer(id: string): PlayerDef {
  const p = PLAYERS.find((v) => v.id === id);
  if (!p) throw new Error(`unknown player ${id}`);
  return p;
}

export function getShot(playerId: string, shotId: string): ShotTypeDef {
  const p = getPlayer(playerId);
  const s = p.shots.find((v) => v.id === shotId);
  if (!s) throw new Error(`unknown shot ${shotId} for ${playerId}`);
  return s;
}

// ---- Stage ----

export interface WaveDef {
  atTick: number;
  enemy: string; // enemy type id
  count: number;
  x0: number; // spawn anchor field coords
  y: number;
  dx: number; // spacing
  hp: number;
  pattern: string; // pattern id
  move: string; // movement id
  dropPower: number;
  dropPoint: number;
  score: number;
  ttl?: number; // ticks before the enemy retreats/flees; default by movement
}

export interface StageDef {
  id: string;
  name: string;
  /** procedural background selector (renderer theme registry) */
  visualTheme: StageVisualId;
  wavesEndTick: number;
  waves: WaveDef[];
  midbossId: string;
  bossId: string;
}

export type StageVisualId = 'mist' | 'cedar' | 'river' | 'forge' | 'inverted' | 'seal';

// Stage registry lives in stages.ts (re-exported here so M1 imports keep working).
export const STAGES: Record<string, StageDef> = ALL_STAGES;
export { ORDER as STAGE_ORDER };

// ---- Bosses ----

export interface BossPhaseDef {
  kind: 'intro' | 'normal' | 'spell' | 'exit';
  hp: number;
  durationTicks: number;
  pattern: string; // '' = none
  /** boss drift behavior; default 'fixed' */
  movement?: BossMovement;
  spellName?: string;
  bonus?: number;
}

export type BossMovement = 'fixed' | 'sideSweep' | 'pendulum';

export interface BossDef {
  id: string;
  name: string;
  title: string;
  phases: BossPhaseDef[];
  contactRadius: number;
  killScore: number;
}

// Boss builders live in bosses.ts (re-exported here so M1 imports keep working).
export { lookupBoss as getBoss };
export { midbossDef, bossDef } from './bosses.js';
