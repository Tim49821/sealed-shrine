import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, parseProgress } from '../src/ui/storage.js';
import { practiceStageIds } from '../src/ui/flow.js';

describe('M2 progress', () => {
  it('recovers invalid progress and accepts valid progress', () => {
    expect(parseProgress('{broken')).toEqual(DEFAULT_PROGRESS);
    expect(parseProgress('{"maxClearedStage":9,"endingsSeen":{"aria":true,"rin":false}}')).toEqual(DEFAULT_PROGRESS);
    expect(parseProgress('{"maxClearedStage":3,"endingsSeen":{"aria":true,"rin":false}}')).toEqual({ maxClearedStage: 3, endingsSeen: { aria: true, rin: false } });
  });

  it('shows only cleared Practice stages', () => {
    expect(practiceStageIds({ maxClearedStage: 1, endingsSeen: { aria: false, rin: false } })).toEqual(['stage1']);
    expect(practiceStageIds({ maxClearedStage: 4, endingsSeen: { aria: false, rin: false } })).toEqual(['stage1', 'stage2', 'stage3', 'stage4']);
  });
});
