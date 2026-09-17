// M2 stage registry: Stage 1-6 wave definitions (design v0.2 §6).
// All names/durations are temporary M2 implementation values.
// Engine resolves by ID; no stage-number branches.
import type { StageDef } from './data.js';

// M1 stage preserved verbatim (visualTheme 'mist' added).
export const STAGE_1: StageDef = {
  id: 'stage1',
  name: 'Draft: Misty Approach',
  visualTheme: 'mist',
  wavesEndTick: 4500,
  waves: [
    { atTick: 60, enemy: 'mote', count: 5, x0: 92, y: -12, dx: 50, hp: 6, pattern: 'weaveAim', move: 'driftDown', dropPower: 1, dropPoint: 1, score: 500 },
    { atTick: 420, enemy: 'mote', count: 5, x0: 92, y: -12, dx: 50, hp: 6, pattern: 'weaveAim', move: 'sineDown', dropPower: 1, dropPoint: 1, score: 500 },
    { atTick: 800, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 22, pattern: 'fanAim', move: 'hover', dropPower: 2, dropPoint: 2, score: 1500 },
    { atTick: 1300, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 50, hp: 7, pattern: 'weaveAim', move: 'driftDown', dropPower: 0, dropPoint: 2, score: 500 },
    { atTick: 1750, enemy: 'weaver', count: 4, x0: 72, y: -12, dx: 80, hp: 24, pattern: 'fanAim', move: 'sineDown', dropPower: 1, dropPoint: 2, score: 1500 },
    { atTick: 2300, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 50, hp: 8, pattern: 'weaveAim', move: 'sineDown', dropPower: 1, dropPoint: 1, score: 600 },
    { atTick: 2800, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 26, pattern: 'burstDelay', move: 'hover', dropPower: 3, dropPoint: 2, score: 1800 },
    { atTick: 3300, enemy: 'mote', count: 5, x0: 92, y: -12, dx: 50, hp: 8, pattern: 'weaveAim', move: 'driftDown', dropPower: 2, dropPoint: 2, score: 600 },
    { atTick: 3800, enemy: 'weaver', count: 4, x0: 72, y: -12, dx: 80, hp: 28, pattern: 'fanAim', move: 'hover', dropPower: 2, dropPoint: 3, score: 2000 },
  ],
  midbossId: 'midboss1',
  bossId: 'boss1',
};

// Stage 2: alternating side entries + slow aimed center fire, corridor + aim overlap last.
export const STAGE_2: StageDef = {
  id: 'stage2',
  name: 'Draft: Lantern Cedar Road',
  visualTheme: 'cedar',
  wavesEndTick: 4500,
  waves: [
    { atTick: 60, enemy: 'mote', count: 4, x0: 42, y: -12, dx: 40, hp: 7, pattern: 'weaveAim', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 550 },
    { atTick: 480, enemy: 'mote', count: 4, x0: 262, y: -12, dx: 40, hp: 7, pattern: 'weaveAim', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 550 },
    { atTick: 900, enemy: 'weaver', count: 2, x0: 152, y: -12, dx: 80, hp: 24, pattern: 'lanternCorridor', move: 'hover', dropPower: 2, dropPoint: 2, score: 1600 },
    { atTick: 1400, enemy: 'mote', count: 5, x0: 62, y: -12, dx: 46, hp: 8, pattern: 'lanternCorridor', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 600 },
    { atTick: 1900, enemy: 'mote', count: 5, x0: 182, y: -12, dx: 46, hp: 8, pattern: 'lanternCorridor', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 600 },
    { atTick: 2400, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 26, pattern: 'fanAim', move: 'sineDown', dropPower: 2, dropPoint: 2, score: 1700 },
    { atTick: 2900, enemy: 'mote', count: 6, x0: 52, y: -12, dx: 44, hp: 8, pattern: 'weaveAim', move: 'diagonalDown', dropPower: 1, dropPoint: 2, score: 650 },
    { atTick: 3400, enemy: 'weaver', count: 3, x0: 102, y: -12, dx: 80, hp: 28, pattern: 'lanternCorridor', move: 'hover', dropPower: 2, dropPoint: 3, score: 1900 },
    { atTick: 3900, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 44, hp: 9, pattern: 'lanternCorridor', move: 'driftDown', dropPower: 2, dropPoint: 2, score: 700 },
  ],
  midbossId: 'midboss2',
  bossId: 'boss2',
};

// Stage 3: left->right / right->left crossers + late center ring.
export const STAGE_3: StageDef = {
  id: 'stage3',
  name: 'Draft: River That Climbs',
  visualTheme: 'river',
  wavesEndTick: 4800,
  waves: [
    { atTick: 60, enemy: 'mote', count: 4, x0: 30, y: 40, dx: 30, hp: 8, pattern: 'currentCross', move: 'crossField', dropPower: 1, dropPoint: 1, score: 600 },
    { atTick: 480, enemy: 'mote', count: 4, x0: 354, y: 60, dx: -30, hp: 8, pattern: 'currentCross', move: 'crossField', dropPower: 1, dropPoint: 1, score: 600 },
    { atTick: 900, enemy: 'weaver', count: 2, x0: 152, y: -12, dx: 80, hp: 26, pattern: 'ringPlain', move: 'hover', dropPower: 2, dropPoint: 2, score: 1700 },
    { atTick: 1350, enemy: 'mote', count: 5, x0: 30, y: 80, dx: 30, hp: 8, pattern: 'currentCross', move: 'crossField', dropPower: 1, dropPoint: 1, score: 650 },
    { atTick: 1800, enemy: 'mote', count: 5, x0: 354, y: 100, dx: -30, hp: 8, pattern: 'currentCross', move: 'crossField', dropPower: 1, dropPoint: 1, score: 650 },
    { atTick: 2250, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 28, pattern: 'currentCross', move: 'stopAndGo', dropPower: 2, dropPoint: 2, score: 1800 },
    { atTick: 2750, enemy: 'mote', count: 6, x0: 30, y: 60, dx: 30, hp: 9, pattern: 'weaveAim', move: 'crossField', dropPower: 1, dropPoint: 2, score: 700 },
    { atTick: 3250, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 30, pattern: 'ringPlain', move: 'hover', dropPower: 2, dropPoint: 3, score: 2000 },
    { atTick: 3750, enemy: 'mote', count: 6, x0: 354, y: 80, dx: -30, hp: 9, pattern: 'currentCross', move: 'crossField', dropPower: 2, dropPoint: 2, score: 700 },
    { atTick: 4200, enemy: 'weaver', count: 3, x0: 102, y: -12, dx: 80, hp: 30, pattern: 'currentCross', move: 'sineDown', dropPower: 2, dropPoint: 3, score: 2100 },
  ],
  midbossId: 'midboss3',
  bossId: 'boss3',
};

// Stage 4: fixed-beat rings alternating with aimed fans, telegraphed by the pattern.
export const STAGE_4: StageDef = {
  id: 'stage4',
  name: 'Draft: Hollow Bell Summit',
  visualTheme: 'forge',
  wavesEndTick: 5100,
  waves: [
    { atTick: 60, enemy: 'weaver', count: 2, x0: 142, y: -12, dx: 100, hp: 26, pattern: 'bellPulse', move: 'hover', dropPower: 2, dropPoint: 2, score: 1700 },
    { atTick: 520, enemy: 'mote', count: 5, x0: 72, y: -12, dx: 48, hp: 9, pattern: 'fanAim', move: 'stopAndGo', dropPower: 1, dropPoint: 1, score: 650 },
    { atTick: 1000, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 28, pattern: 'bellPulse', move: 'stopAndGo', dropPower: 2, dropPoint: 2, score: 1800 },
    { atTick: 1520, enemy: 'mote', count: 5, x0: 72, y: -12, dx: 48, hp: 9, pattern: 'fanAim', move: 'driftDown', dropPower: 1, dropPoint: 2, score: 650 },
    { atTick: 2040, enemy: 'weaver', count: 2, x0: 142, y: -12, dx: 100, hp: 30, pattern: 'bellPulse', move: 'hover', dropPower: 3, dropPoint: 2, score: 1900 },
    { atTick: 2560, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 46, hp: 10, pattern: 'fanAim', move: 'stopAndGo', dropPower: 1, dropPoint: 2, score: 700 },
    { atTick: 3080, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 30, pattern: 'bellPulse', move: 'hover', dropPower: 2, dropPoint: 3, score: 2000 },
    { atTick: 3600, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 46, hp: 10, pattern: 'fanAim', move: 'sineDown', dropPower: 2, dropPoint: 2, score: 700 },
    { atTick: 4120, enemy: 'weaver', count: 3, x0: 102, y: -12, dx: 80, hp: 32, pattern: 'bellPulse', move: 'stopAndGo', dropPower: 2, dropPoint: 3, score: 2100 },
    { atTick: 4600, enemy: 'mote', count: 5, x0: 82, y: -12, dx: 48, hp: 10, pattern: 'burstDelay', move: 'driftDown', dropPower: 2, dropPoint: 2, score: 750 },
  ],
  midbossId: 'midboss4',
  bossId: 'boss4',
};

// Stage 5: mirrored pairs with a fixed center gap; reverse spiral only on hard+.
export const STAGE_5: StageDef = {
  id: 'stage5',
  name: 'Draft: Inverted Inner Court',
  visualTheme: 'inverted',
  wavesEndTick: 5400,
  waves: [
    { atTick: 60, enemy: 'mote', count: 4, x0: 52, y: -12, dx: 40, hp: 10, pattern: 'mirrorPair', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 700 },
    { atTick: 500, enemy: 'mote', count: 4, x0: 252, y: -12, dx: 40, hp: 10, pattern: 'mirrorPair', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 700 },
    { atTick: 940, enemy: 'weaver', count: 2, x0: 92, y: -12, dx: 200, hp: 32, pattern: 'mirrorPair', move: 'hover', dropPower: 2, dropPoint: 2, score: 2000 },
    { atTick: 1420, enemy: 'mote', count: 6, x0: 42, y: -12, dx: 40, hp: 10, pattern: 'mirrorPair', move: 'crossField', dropPower: 1, dropPoint: 2, score: 750 },
    { atTick: 1900, enemy: 'mote', count: 6, x0: 202, y: -12, dx: 40, hp: 10, pattern: 'mirrorPair', move: 'crossField', dropPower: 1, dropPoint: 2, score: 750 },
    { atTick: 2380, enemy: 'weaver', count: 3, x0: 72, y: -12, dx: 120, hp: 34, pattern: 'spiralTwin', move: 'sineDown', dropPower: 2, dropPoint: 2, score: 2100 },
    { atTick: 2860, enemy: 'mote', count: 5, x0: 62, y: -12, dx: 46, hp: 11, pattern: 'mirrorPair', move: 'diagonalDown', dropPower: 2, dropPoint: 2, score: 750 },
    { atTick: 3340, enemy: 'weaver', count: 2, x0: 92, y: -12, dx: 200, hp: 34, pattern: 'mirrorPair', move: 'hover', dropPower: 3, dropPoint: 2, score: 2200 },
    { atTick: 3820, enemy: 'mote', count: 6, x0: 52, y: -12, dx: 44, hp: 11, pattern: 'mirrorPair', move: 'stopAndGo', dropPower: 1, dropPoint: 2, score: 800 },
    { atTick: 4300, enemy: 'weaver', count: 3, x0: 102, y: -12, dx: 80, hp: 36, pattern: 'mirrorPair', move: 'hover', dropPower: 2, dropPoint: 3, score: 2300 },
    { atTick: 4780, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 44, hp: 11, pattern: 'mirrorPair', move: 'driftDown', dropPower: 2, dropPoint: 2, score: 800 },
  ],
  midbossId: 'midboss5',
  bossId: 'boss5',
};

// Stage 6: short reuse of stage 2-5 motifs, combined only in the last two waves.
export const STAGE_6: StageDef = {
  id: 'stage6',
  name: 'Draft: Chamber of Empty Vows',
  visualTheme: 'seal',
  wavesEndTick: 4200,
  waves: [
    { atTick: 60, enemy: 'mote', count: 5, x0: 72, y: -12, dx: 48, hp: 10, pattern: 'lanternCorridor', move: 'diagonalDown', dropPower: 1, dropPoint: 1, score: 750 },
    { atTick: 520, enemy: 'mote', count: 5, x0: 72, y: 40, dx: 48, hp: 10, pattern: 'currentCross', move: 'crossField', dropPower: 1, dropPoint: 1, score: 750 },
    { atTick: 980, enemy: 'weaver', count: 2, x0: 142, y: -12, dx: 100, hp: 34, pattern: 'bellPulse', move: 'hover', dropPower: 2, dropPoint: 2, score: 2200 },
    { atTick: 1480, enemy: 'mote', count: 5, x0: 72, y: -12, dx: 48, hp: 11, pattern: 'mirrorPair', move: 'diagonalDown', dropPower: 1, dropPoint: 2, score: 800 },
    { atTick: 1980, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 36, pattern: 'lanternCorridor', move: 'stopAndGo', dropPower: 2, dropPoint: 2, score: 2300 },
    { atTick: 2480, enemy: 'mote', count: 6, x0: 62, y: -12, dx: 46, hp: 11, pattern: 'currentCross', move: 'crossField', dropPower: 2, dropPoint: 2, score: 800 },
    { atTick: 2980, enemy: 'weaver', count: 3, x0: 112, y: -12, dx: 80, hp: 36, pattern: 'bellPulse', move: 'hover', dropPower: 2, dropPoint: 3, score: 2400 },
    { atTick: 3440, enemy: 'weaver', count: 4, x0: 72, y: -12, dx: 80, hp: 38, pattern: 'vowComposite', move: 'stopAndGo', dropPower: 2, dropPoint: 3, score: 2500 },
    { atTick: 3880, enemy: 'weaver', count: 4, x0: 72, y: -12, dx: 80, hp: 38, pattern: 'vowComposite', move: 'hover', dropPower: 3, dropPoint: 3, score: 2600 },
  ],
  midbossId: 'midboss6',
  bossId: 'boss6',
};

export const STAGES: Record<string, StageDef> = {
  stage1: STAGE_1,
  stage2: STAGE_2,
  stage3: STAGE_3,
  stage4: STAGE_4,
  stage5: STAGE_5,
  stage6: STAGE_6,
};
