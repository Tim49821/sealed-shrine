// Replay validation tests: reject damaged/incompatible/oversize files.
import { describe, expect, it } from 'vitest';
import { CONTENT_VERSION, GAME_VERSION, parseReplayJson, validateReplay } from '../src/replay/replay.js';
import { STAGE_ORDER } from '../src/core/run.js';

function good(): Record<string, unknown> {
  return {
    header: {
      schemaVersion: 2, gameVersion: '0.2.0', contentVersion: 'main6-draft.1',
      seed: 7, mode: 'story', startAt: 'stage', stageId: 'stage1',
      difficulty: 'normal', playerId: 'aria', shotType: 'aria-a',
    },
    inputs: [0, 16, 17],
  };
}

describe('replay validation', () => {
  it('pins M2 versions', () => {
    expect(GAME_VERSION).toBe('0.2.0');
    expect(CONTENT_VERSION).toBe('main6-draft.1');
  });

  it('accepts every stage for practice boss starts', () => {
    for (const stageId of STAGE_ORDER) {
      const file = good();
      Object.assign(file.header as object, { mode: 'practice', stageId, startAt: 'boss' });
      expect(validateReplay(file).header.stageId).toBe(stageId);
    }
  });

  it('rejects story files that do not start at stage1', () => {
    const badStory = good();
    Object.assign(badStory.header as object, { mode: 'story', stageId: 'stage2' });
    expect(() => validateReplay(badStory)).toThrow(/story must start at stage1/);
    const badStart = good();
    Object.assign(badStart.header as object, { mode: 'story', startAt: 'boss' });
    expect(() => validateReplay(badStart)).toThrow(/story must start at stage1/);
  });

  it('rejects the M1 content version', () => {
    const old = good();
    Object.assign(old.header as object, { contentVersion: 'stage1-draft.1' });
    expect(() => validateReplay(old)).toThrow(/contentVersion/);
  });

  it('accepts a valid file', () => {
    expect(validateReplay(good()).inputs).toHaveLength(3);
  });

  it.each([
    ['bad schema', { schemaVersion: 99 }],
    ['bad game version', { gameVersion: '9.9.9' }],
    ['bad content', { contentVersion: 'nope' }],
    ['bad seed', { seed: -1 }],
    ['bad mode', { mode: 'extra' }],
    ['unknown stage', { stageId: 'stage9' }],
    ['bad difficulty', { difficulty: 'inferno' }],
    ['unknown shot', { playerId: 'aria', shotType: 'zzz' }],
  ])('rejects %s', (_name, patch) => {
    const g = good();
    Object.assign(g.header as object, patch);
    expect(() => validateReplay(g)).toThrow();
  });

  it('rejects bad bitmask and empty/oversize input arrays', () => {
    const g = good();
    (g.inputs as number[])[1] = 128;
    expect(() => validateReplay(g)).toThrow();
    expect(() => validateReplay({ ...good(), inputs: [] })).toThrow();
    expect(() => validateReplay({ ...good(), inputs: new Array(216001).fill(0) })).toThrow();
  });

  it('rejects broken JSON and oversize text', () => {
    expect(() => parseReplayJson('not json')).toThrow();
    expect(() => parseReplayJson('x'.repeat(6 * 1024 * 1024))).toThrow();
  });

  it('measures UTF-8 bytes, not chars, for the size limit', () => {
    // 'あ' is 3 bytes in UTF-8: 2M chars = 6MB > 5MB limit
    const g = good() as { header: object; inputs: number[] };
    const padded = `${JSON.stringify(g).slice(0, -1)},"note":"${'あ'.repeat(2_000_000)}"}`;
    expect(padded.length).toBeLessThan(5 * 1024 * 1024);
    expect(() => parseReplayJson(padded)).toThrow(/too large/);
  });

  it('accepts schema v1 as story-from-stage, validates startAt in v2', () => {
    const v1 = good();
    const h1 = v1.header as Record<string, unknown>;
    delete h1.startAt;
    h1.schemaVersion = 1;
    expect(validateReplay(v1).header.startAt).toBe('stage');

    const badStart = good();
    (badStart.header as Record<string, unknown>).startAt = 'midboss';
    // story must start at stage
    expect(() => validateReplay(badStart)).toThrow();
    // practice may start anywhere
    (badStart.header as Record<string, unknown>).mode = 'practice';
    expect(validateReplay(badStart).header.startAt).toBe('midboss');

    const badEnum = good();
    (badEnum.header as Record<string, unknown>).mode = 'practice';
    (badEnum.header as Record<string, unknown>).startAt = 'extra';
    expect(() => validateReplay(badEnum)).toThrow();
  });
});
