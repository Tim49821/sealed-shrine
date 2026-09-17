// M2 boss registry: midbosses + main bosses for stages 1-6 (design v0.2 §7).
// All names/HP/durations are temporary M2 implementation values.
// Main phase counts [normal, spell]: b1 [2,2], b2 [2,2], b3 [2,2],
// b4 [2,3], b5 [3,3], b6 [3,4]. Midbosses are intro + normal + spell + exit.
import type { DifficultyId } from '../core/types.js';
import type { BossDef } from './data.js';

const MUL: [number, number, number, number] = [0.7, 1, 1.3, 1.6];
const MID_MUL: [number, number, number, number] = [0.7, 1, 1.25, 1.5];

function hp(base: number, d: DifficultyId, mul: [number, number, number, number] = MUL): number {
  return Math.round(base * mul[['easy', 'normal', 'hard', 'lunatic'].indexOf(d)]!);
}

// ---- M1 bosses (preserved verbatim) ----

export function midbossDef(d: DifficultyId): BossDef {
  return {
    id: 'midboss1',
    name: 'Draft Gatekeeper Sui',
    title: 'mist warden (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(320, d, MID_MUL), durationTicks: 60 * 45, pattern: 'fanAim' },
      { kind: 'spell', hp: hp(420, d, MID_MUL), durationTicks: 60 * 45, pattern: 'ringPlain', spellName: 'Mist Sign "Hollow Ring" (draft)', bonus: 100000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 30000,
  };
}

export function bossDef(d: DifficultyId): BossDef {
  return {
    id: 'boss1',
    name: 'Draft Shrine Twin Kiri',
    title: 'twin of the sealed shrine (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(380, d), durationTicks: 60 * 40, pattern: 'fanAim' },
      { kind: 'spell', hp: hp(520, d), durationTicks: 60 * 50, pattern: 'spiralTwin', spellName: '"Twin Coil Vigil" (draft)', bonus: 200000 },
      { kind: 'normal', hp: hp(460, d), durationTicks: 60 * 45, pattern: 'burstDelay' },
      { kind: 'spell', hp: hp(640, d), durationTicks: 60 * 55, pattern: 'ringPlain', spellName: '"Lantern Sea Requiem" (draft)', bonus: 300000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 100000,
  };
}

// ---- M2 midbosses ----

function midboss2(d: DifficultyId): BossDef {
  return {
    id: 'midboss2',
    name: 'Draft Lantern Keeper Kaho',
    title: 'keeper of the last lantern (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(330, d, MID_MUL), durationTicks: 60 * 40, pattern: 'lanternCorridor' },
      { kind: 'spell', hp: hp(430, d, MID_MUL), durationTicks: 60 * 45, pattern: 'lanternCorridor', spellName: 'Lamp Sign "Moth at the Last Lantern" (draft)', bonus: 100000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 30000,
  };
}

function midboss3(d: DifficultyId): BossDef {
  return {
    id: 'midboss3',
    name: 'Draft Ferryman Towa',
    title: 'ferryman of the upstream tide (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(330, d, MID_MUL), durationTicks: 60 * 40, pattern: 'currentCross', movement: 'sideSweep' },
      { kind: 'spell', hp: hp(430, d, MID_MUL), durationTicks: 60 * 45, pattern: 'currentCross', spellName: 'Shore Sign "Bell Beneath the Upstream Tide" (draft)', bonus: 100000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 30000,
  };
}

function midboss4(d: DifficultyId): BossDef {
  return {
    id: 'midboss4',
    name: 'Draft Forge Guard Gaku',
    title: 'guardian of the summit stones (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(340, d, MID_MUL), durationTicks: 60 * 40, pattern: 'bellPulse' },
      { kind: 'spell', hp: hp(440, d, MID_MUL), durationTicks: 60 * 45, pattern: 'bellPulse', spellName: 'Stone Sign "Echo Nested in Granite" (draft)', bonus: 110000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 32000,
  };
}

function midboss5(d: DifficultyId): BossDef {
  return {
    id: 'midboss5',
    name: 'Draft Mirror Beast Raku',
    title: 'beast of paired footsteps (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(340, d, MID_MUL), durationTicks: 60 * 40, pattern: 'mirrorPair', movement: 'pendulum' },
      { kind: 'spell', hp: hp(440, d, MID_MUL), durationTicks: 60 * 45, pattern: 'mirrorPair', spellName: 'Mirror Beast "Paired Footsteps" (draft)', bonus: 110000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 32000,
  };
}

function midboss6(d: DifficultyId): BossDef {
  return {
    id: 'midboss6',
    name: 'Draft Blank Page Haku',
    title: 'the last unwritten line (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 120, pattern: '' },
      { kind: 'normal', hp: hp(340, d, MID_MUL), durationTicks: 60 * 40, pattern: 'vowComposite', movement: 'sideSweep' },
      { kind: 'spell', hp: hp(440, d, MID_MUL), durationTicks: 60 * 45, pattern: 'vowComposite', spellName: 'Blank Page "One Line Left Unwritten" (draft)', bonus: 120000 },
      { kind: 'exit', hp: 1, durationTicks: 90, pattern: '' },
    ],
    contactRadius: 14,
    killScore: 34000,
  };
}

// ---- M2 main bosses ----

function boss2(d: DifficultyId): BossDef {
  return {
    id: 'boss2',
    name: 'Draft Lantern Weaver Iori',
    title: 'weaver of unsent letters (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(380, d), durationTicks: 60 * 40, pattern: 'lanternCorridor', movement: 'sideSweep' },
      { kind: 'spell', hp: hp(520, d), durationTicks: 60 * 50, pattern: 'lanternCorridor', spellName: 'Vow Sign "Thousand Unsent Letters" (draft)', bonus: 200000 },
      { kind: 'normal', hp: hp(460, d), durationTicks: 60 * 45, pattern: 'fanAim' },
      { kind: 'spell', hp: hp(640, d), durationTicks: 60 * 55, pattern: 'lanternCorridor', spellName: 'Lantern Sign "Path That Forgets Footsteps" (draft)', bonus: 300000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 100000,
  };
}

function boss3(d: DifficultyId): BossDef {
  return {
    id: 'boss3',
    name: 'Draft Ferrymaster Nami',
    title: 'carrier of names (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(390, d), durationTicks: 60 * 40, pattern: 'currentCross', movement: 'pendulum' },
      { kind: 'spell', hp: hp(530, d), durationTicks: 60 * 50, pattern: 'currentCross', spellName: 'Current Sign "River Climbing Its Own Source" (draft)', bonus: 200000 },
      { kind: 'normal', hp: hp(470, d), durationTicks: 60 * 45, pattern: 'ringPlain' },
      { kind: 'spell', hp: hp(650, d), durationTicks: 60 * 55, pattern: 'currentCross', spellName: 'Name Sign "Ferry of the Nameless Moon" (draft)', bonus: 300000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 100000,
  };
}

function boss4(d: DifficultyId): BossDef {
  return {
    id: 'boss4',
    name: 'Draft Bellfounder En',
    title: 'founder of the empty bell (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(440, d), durationTicks: 60 * 40, pattern: 'bellPulse' },
      { kind: 'spell', hp: hp(600, d), durationTicks: 60 * 50, pattern: 'bellPulse', spellName: 'Bell Sign "Seven Echoes Without a Striker" (draft)', bonus: 220000 },
      { kind: 'normal', hp: hp(520, d), durationTicks: 60 * 45, pattern: 'fanAim', movement: 'sideSweep' },
      { kind: 'spell', hp: hp(700, d), durationTicks: 60 * 50, pattern: 'bellPulse', spellName: 'Forge Sign "Red Iron Constellation" (draft)', bonus: 280000 },
      { kind: 'spell', hp: hp(760, d), durationTicks: 60 * 55, pattern: 'bellPulse', spellName: 'Key Sign "Resonance That Opens Stone" (draft)', bonus: 320000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 120000,
  };
}

function boss5(d: DifficultyId): BossDef {
  return {
    id: 'boss5',
    name: 'Draft Gatekeeper Shizu',
    title: 'keeper of the inverted gate (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(440, d), durationTicks: 60 * 40, pattern: 'mirrorPair', movement: 'sideSweep' },
      { kind: 'normal', hp: hp(480, d), durationTicks: 60 * 40, pattern: 'spiralTwin', movement: 'pendulum' },
      { kind: 'spell', hp: hp(620, d), durationTicks: 60 * 50, pattern: 'mirrorPair', spellName: 'Mirror Sign "Gate Facing Both Ways" (draft)', bonus: 240000 },
      { kind: 'normal', hp: hp(520, d), durationTicks: 60 * 45, pattern: 'burstDelay' },
      { kind: 'spell', hp: hp(720, d), durationTicks: 60 * 50, pattern: 'mirrorPair', spellName: 'Reverse Sign "Pilgrimage From the Last Step" (draft)', bonus: 300000 },
      { kind: 'spell', hp: hp(780, d), durationTicks: 60 * 55, pattern: 'mirrorPair', spellName: 'Boundary Sign "Inner Court Without an Outside" (draft)', bonus: 340000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 140000,
  };
}

function boss6(d: DifficultyId): BossDef {
  return {
    id: 'boss6',
    name: 'Draft Warden Mikage',
    title: 'warden of the sealed shrine (draft)',
    phases: [
      { kind: 'intro', hp: 1, durationTicks: 150, pattern: '' },
      { kind: 'normal', hp: hp(420, d), durationTicks: 60 * 40, pattern: 'lanternCorridor', movement: 'sideSweep' },
      { kind: 'spell', hp: hp(580, d), durationTicks: 60 * 50, pattern: 'vowComposite', spellName: 'Seal Sign "Ledger of Abandoned Vows" (draft)', bonus: 260000 },
      { kind: 'normal', hp: hp(460, d), durationTicks: 60 * 40, pattern: 'currentCross', movement: 'pendulum' },
      { kind: 'spell', hp: hp(640, d), durationTicks: 60 * 50, pattern: 'vowComposite', spellName: 'Memory Sign "Names Returning as Ash" (draft)', bonus: 300000 },
      { kind: 'normal', hp: hp(500, d), durationTicks: 60 * 45, pattern: 'bellPulse' },
      { kind: 'spell', hp: hp(700, d), durationTicks: 60 * 50, pattern: 'vowComposite', spellName: 'Empty Sign "Merciful Erasure" (draft)', bonus: 340000 },
      { kind: 'spell', hp: hp(760, d), durationTicks: 60 * 55, pattern: 'vowComposite', spellName: 'Final Seal "A Shrine That Must Learn to Breathe" (draft)', bonus: 400000 },
      { kind: 'exit', hp: 1, durationTicks: 120, pattern: '' },
    ],
    contactRadius: 16,
    killScore: 160000,
  };
}

const BOSS_BUILDERS: Record<string, (d: DifficultyId) => BossDef> = {
  midboss1: midbossDef,
  midboss2, midboss3, midboss4, midboss5, midboss6,
  boss1: bossDef,
  boss2, boss3, boss4, boss5, boss6,
};

export function getBoss(id: string, d: DifficultyId): BossDef {
  const build = BOSS_BUILDERS[id];
  if (!build) throw new Error(`unknown boss ${id}`);
  return build(d);
}
