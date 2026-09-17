// M2 Story run state (design v0.2 §3). Plain data + pure transforms only:
// one GameCore per stage, carry holds the persistent fields between cores.
export const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6'] as const;

export type StageId = (typeof STAGE_ORDER)[number];

export function isStageId(id: string): id is StageId {
  return (STAGE_ORDER as readonly string[]).includes(id);
}

export interface RunCarry {
  score: number;
  graze: number;
  lives: number;
  bombs: number;
  power: number;
  extendsAwarded: boolean[];
}

export function copyRunCarry(source: RunCarry): RunCarry {
  // Pick exactly the persistent fields: sources may be a GameCore instance
  // carrying transient sim state that must never leak into the next stage.
  return {
    score: source.score,
    graze: source.graze,
    lives: source.lives,
    bombs: source.bombs,
    power: source.power,
    extendsAwarded: [...source.extendsAwarded],
  };
}

export function deriveStageSeed(runSeed: number, stageIndex: number): number {
  let x = ((runSeed >>> 0) ^ Math.imul(stageIndex + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

export function nextStageId(id: StageId): StageId | null {
  const i = STAGE_ORDER.indexOf(id);
  if (i < 0 || i + 1 >= STAGE_ORDER.length) return null;
  return STAGE_ORDER[i + 1]!;
}
