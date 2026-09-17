import { describe, expect, it } from 'vitest';
import { STAGE_ORDER } from '../src/core/run.js';
import { STAGES, getBoss } from '../src/content/data.js';
import { PATTERNS, type PatternCtx } from '../src/content/patterns.js';
import { Rng } from '../src/core/rng.js';
import type { DifficultyId } from '../src/core/types.js';
import { DIFFICULTIES } from '../src/core/types.js';
import { getDialogue, getEnding } from '../src/content/dialogue.js';

describe('M2 content registry', () => {
  it.each(STAGE_ORDER)('%s resolves every required content reference', (stageId) => {
    const stage = STAGES[stageId];
    expect(stage.id).toBe(stageId);
    const minWaves = stageId === 'stage2' || stageId === 'stage6' ? 8 : 9;
    expect(stage.waves.length).toBeGreaterThanOrEqual(minWaves);
    expect(() => getBoss(stage.midbossId, 'normal')).not.toThrow();
    expect(() => getBoss(stage.bossId, 'normal')).not.toThrow();
    for (const playerId of ['aria', 'rin'] as const) {
      expect(getDialogue(stageId, playerId, 'midbossBefore')).toHaveLength(1);
      expect(getDialogue(stageId, playerId, 'midbossAfter')).toHaveLength(1);
      expect(getDialogue(stageId, playerId, 'bossBefore').length).toBeGreaterThanOrEqual(6);
      expect(getDialogue(stageId, playerId, 'bossAfter').length).toBeGreaterThanOrEqual(3);
    }
  });

  it('provides distinct character endings', () => {
    expect(getEnding('aria')).not.toEqual(getEnding('rin'));
    expect(getEnding('aria').length).toBeGreaterThanOrEqual(4);
    expect(getEnding('rin').length).toBeGreaterThanOrEqual(4);
  });
});

function referencedPatternIds(): string[] {
  const ids = new Set<string>();
  for (const stageId of STAGE_ORDER) {
    for (const w of STAGES[stageId]!.waves) ids.add(w.pattern);
    for (const d of DIFFICULTIES) {
      const stage = STAGES[stageId]!;
      for (const bossId of [stage.midbossId, stage.bossId]) {
        for (const p of getBoss(bossId, d).phases) if (p.pattern) ids.add(p.pattern);
      }
    }
  }
  return [...ids];
}

function missingPatternIds(): string[] {
  return referencedPatternIds().filter((id) => !PATTERNS[id]);
}

function patternStats(id: string, difficulty: DifficultyId): { count: number; angles: string } {
  const vels: [number, number][] = [];
  const rng = new Rng(1234);
  const ctx: PatternCtx = {
    tick: 0, phaseTick: 0, difficulty,
    emitter: { x: 192, y: 110 }, playerX: 192, playerY: 400, rng,
    spawn: (x, y, vx, vy) => { vels.push([vx, vy]); return true; },
  };
  for (let t = 1; t <= 1200; t++) {
    ctx.phaseTick = t;
    ctx.tick = t;
    PATTERNS[id]!(ctx);
  }
  const angles = [...new Set(vels.map(([vx, vy]) => (Math.atan2(vy, vx)).toFixed(2)))].sort().join(',');
  return { count: vels.length, angles };
}

describe('M2 patterns', () => {
  it('registers every pattern referenced by waves and boss phases', () => {
    expect(missingPatternIds()).toEqual([]);
  });

  it.each(['lanternCorridor', 'currentCross', 'bellPulse', 'mirrorPair', 'vowComposite'])(
    '%s differs between easy and lunatic in count and angles',
    (id) => {
      const easy = patternStats(id, 'easy');
      const lunatic = patternStats(id, 'lunatic');
      expect(easy.count).toBeGreaterThan(0);
      expect(lunatic.count).toBeGreaterThan(easy.count);
      expect(lunatic.angles).not.toEqual(easy.angles);
    },
  );
});
