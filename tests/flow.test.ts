// Flow helper tests: pause/result menus, hiscore rules, text wrapping.
import { describe, expect, it } from 'vitest';
import { isFinalStoryStage, nextStoryStage, pauseItems, resultItemsFor, shouldSaveHiscore, wrapText } from '../src/ui/flow.js';

describe('pause menu', () => {
  it('run and replay pause menus expose matching item counts', () => {
    // main.ts navigates with items.length, so these arrays are the contract
    expect(pauseItems(false)).toEqual(['Resume', 'Restart', 'Quit to Title']);
    expect(pauseItems(true)).toEqual(['Resume', 'Restart Replay', 'Quit to Title']);
    expect(pauseItems(false)).toHaveLength(3);
    expect(pauseItems(true)).toHaveLength(3);
  });
});

describe('result menu', () => {
  it('offers replay save only for live runs', () => {
    expect(resultItemsFor('run')).toContain('Save Replay (download)');
    expect(resultItemsFor('replay')).not.toContain('Save Replay (download)');
    expect(resultItemsFor('rejected')).toEqual(['Back to Title']);
  });
});

describe('hiscore pollution', () => {
  it('saves only story clears from live play', () => {
    expect(shouldSaveHiscore({ isReplayPlayback: false, mode: 'story', phase: 'clear' })).toBe(true);
    expect(shouldSaveHiscore({ isReplayPlayback: false, mode: 'story', phase: 'gameover' })).toBe(false);
    expect(shouldSaveHiscore({ isReplayPlayback: false, mode: 'practice', phase: 'clear' })).toBe(false);
    // replay of a story clear must not touch the Story hiscore
    expect(shouldSaveHiscore({ isReplayPlayback: true, mode: 'story', phase: 'clear' })).toBe(false);
  });
});

describe('wrapText', () => {
  it('keeps every line within width and preserves content', () => {
    const lines = wrapText('Mist Sign "Hollow Ring" (draft): captured | bonus 100000', 24);
    expect(lines.every((l) => l.length <= 24)).toBe(true);
    expect(lines.join(' ').replace(/\s+/g, ' ')).toContain('Hollow Ring');
  });
});

describe('story order', () => {
  it('walks stage1 to stage6 and ends after the final stage', () => {
    expect(nextStoryStage('stage1')).toBe('stage2');
    expect(nextStoryStage('stage5')).toBe('stage6');
    expect(nextStoryStage('stage6')).toBeNull();
    expect(isFinalStoryStage('stage6')).toBe(true);
    expect(isFinalStoryStage('stage5')).toBe(false);
  });
});

describe('stage themes', () => {
  it('resolves six distinct palettes', async () => {
    const { themePalette } = await import('../src/ui/themes.js');
    const ids = ['mist', 'cedar', 'river', 'forge', 'inverted', 'seal'] as const;
    const accents = new Set<string>();
    for (const id of ids) {
      const p = themePalette(id);
      expect(typeof p.sky).toBe('number');
      expect(typeof p.ground).toBe('number');
      expect(typeof p.accent).toBe('number');
      expect(typeof p.motif).toBe('string');
      accents.add(String(p.accent));
    }
    expect(accents.size).toBe(ids.length);
  });
});
