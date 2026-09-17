// Pure menu/result flow helpers (no DOM). Unit-tested in tests/flow.test.ts.
// Keeps pause/result item counts, hiscore rules, and text wrapping in one place
// so main.ts cannot drift out of sync with what it renders.
import type { GameMode, PhaseKind } from '../core/types.js';
import { STAGE_ORDER, type StageId } from '../core/run.js';
import type { ProgressV2 } from './storage.js';

/** Stage IDs unlocked for Practice: stage 1 plus every cleared stage. */
export function practiceStageIds(progress: ProgressV2): StageId[] {
  const n = progress.maxClearedStage;
  return STAGE_ORDER.filter((_, i) => i < n);
}

/** Next Story stage, or null on the final stage. */
export function nextStoryStage(id: StageId): StageId | null {
  const i = STAGE_ORDER.indexOf(id);
  if (i < 0 || i + 1 >= STAGE_ORDER.length) return null;
  return STAGE_ORDER[i + 1]!;
}

export function isFinalStoryStage(id: StageId): boolean {
  return nextStoryStage(id) === null;
}

export function pauseItems(isReplay: boolean): string[] {
  return isReplay
    ? ['Resume', 'Restart Replay', 'Quit to Title']
    : ['Resume', 'Restart', 'Quit to Title'];
}

export type ResultKind = 'rejected' | 'replay' | 'run';

export function resultItemsFor(kind: ResultKind): string[] {
  if (kind === 'rejected') return ['Back to Title'];
  if (kind === 'replay') return ['Watch Again', 'Back to Title'];
  return ['Retry', 'Save Replay (download)', 'Back to Title'];
}

export function shouldSaveHiscore(opts: {
  isReplayPlayback: boolean;
  mode: GameMode;
  phase: PhaseKind;
}): boolean {
  // Practice/Replay never pollute the Story hiscore.
  if (opts.isReplayPlayback) return false;
  if (opts.mode !== 'story') return false;
  return opts.phase === 'clear';
}

/** Greedy word/char wrap for fixed-pixel overlay text. */
export function wrapText(s: string, width: number): string[] {
  const out: string[] = [];
  for (const raw of s.split('\n')) {
    let line = raw;
    if (line.length <= width) {
      out.push(line);
      continue;
    }
    while (line.length > width) {
      let cut = line.lastIndexOf(' ', width);
      if (cut <= 0) cut = width;
      out.push(line.slice(0, cut));
      line = line.slice(cut).trimStart();
    }
    out.push(line);
  }
  return out;
}
