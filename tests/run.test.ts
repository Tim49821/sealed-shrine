import { describe, expect, it } from 'vitest';
import { GameCore } from '../src/core/gameCore.js';
import { STAGE_ORDER, copyRunCarry, deriveStageSeed } from '../src/core/run.js';

describe('M2 run state', () => {
  it('keeps the fixed six-stage order and stable seed vectors', () => {
    expect(STAGE_ORDER).toEqual(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6']);
    expect(deriveStageSeed(0, 0)).toBe(301794027);
    expect(deriveStageSeed(42, 1)).toBe(2860932040);
    expect(deriveStageSeed(42, 5)).toBe(1322396689);
  });

  it('copies persistent state and resets transient state in the next core', () => {
    const first = new GameCore({ seed: 1, mode: 'story', stageId: 'stage1', difficulty: 'normal', playerId: 'aria', shotId: 'aria-a' });
    Object.assign(first, { score: 123456, graze: 77, lives: 5, bombs: 1, power: 3.25 });
    first.extendsAwarded = [true, true, false];
    const next = new GameCore({ seed: deriveStageSeed(1, 1), mode: 'story', stageId: 'stage1', difficulty: 'normal', playerId: 'aria', shotId: 'aria-a', carry: copyRunCarry(first) });
    expect(copyRunCarry(next)).toEqual(copyRunCarry(first));
    expect([next.px, next.py, next.pendingDeath, next.invuln, next.bombActive, next.prevMask]).toEqual([192, 400, -1, 0, 0, 0]);
    expect(next.bullets.alive + next.shots.alive + next.items.filter((v) => v.active).length).toBe(0);
  });
});
