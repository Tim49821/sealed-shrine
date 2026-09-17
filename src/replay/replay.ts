// Replay: header + per-tick input bitmask array. JSON download/import with
// validation. No position snapshots. Pause/menu inputs excluded (only step()
// masks are recorded).
import { ALL_INPUT_BITS, DIFFICULTIES, MODES, type DifficultyId, type GameMode } from '../core/types.js';
import { STAGE_ORDER, copyRunCarry, deriveStageSeed, type RunCarry, type StageId } from '../core/run.js';
import { GameCore } from '../core/gameCore.js';
import { PLAYERS } from '../content/data.js';

export const REPLAY_SCHEMA_VERSION = 2;
export const GAME_VERSION = '0.2.0';
export const CONTENT_VERSION = 'main6-draft.1';
export const MAX_TICKS = 216000; // 1 hour at 60Hz
export const MAX_BYTES = 5 * 1024 * 1024;

export type StartAt = 'stage' | 'midboss' | 'boss';
export const START_ATS: StartAt[] = ['stage', 'midboss', 'boss'];

export interface ReplayHeader {
  schemaVersion: number;
  gameVersion: string;
  contentVersion: string;
  seed: number;
  mode: GameMode;
  /** practice start point; always 'stage' for story. Absent in schema v1. */
  startAt: StartAt;
  stageId: string;
  difficulty: DifficultyId;
  playerId: string;
  shotType: string;
}

export interface ReplayFile {
  header: ReplayHeader;
  inputs: number[];
}

function validShot(playerId: string, shotType: string): boolean {
  const p = PLAYERS.find((v) => v.id === playerId);
  return !!p && p.shots.some((s) => s.id === shotType);
}

/** Throws on invalid. Rejects unknown/oversize. Never crashes the game. */
export function validateReplay(data: unknown): ReplayFile {
  if (typeof data !== 'object' || data === null) throw new Error('replay: not an object');
  const d = data as Record<string, unknown>;
  const h = d.header as Record<string, unknown>;
  if (typeof h !== 'object' || h === null) throw new Error('replay: bad header');
  // schema v1 files (no startAt) are accepted as story-from-stage for compat
  if (h.schemaVersion !== REPLAY_SCHEMA_VERSION && h.schemaVersion !== 1) {
    throw new Error('replay: unsupported schemaVersion');
  }
  if (h.gameVersion !== GAME_VERSION) throw new Error('replay: unsupported gameVersion');
  if (h.contentVersion !== CONTENT_VERSION) throw new Error('replay: unsupported contentVersion');
  const seed = h.seed;
  if (typeof seed !== 'number' || !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('replay: bad seed');
  }
  if (h.mode !== 'story' && h.mode !== 'practice') throw new Error('replay: bad mode');
  const startAt = h.schemaVersion === 1 ? 'stage' : h.startAt;
  if (!START_ATS.includes(startAt as StartAt)) throw new Error('replay: bad startAt');
  // Story always starts at stage1/stage; Practice allows any stage 1-6 + start point.
  if (h.mode === 'story') {
    if (h.stageId !== 'stage1' || startAt !== 'stage') throw new Error('replay: story must start at stage1');
  } else {
    if (!(STAGE_ORDER as readonly string[]).includes(h.stageId as string)) throw new Error('replay: unknown stageId');
  }
  if (!DIFFICULTIES.includes(h.difficulty as DifficultyId)) throw new Error('replay: bad difficulty');
  if (typeof h.playerId !== 'string' || typeof h.shotType !== 'string') throw new Error('replay: bad player');
  if (!validShot(h.playerId, h.shotType)) throw new Error('replay: unknown player/shot');
  if (!MODES.includes(h.mode as GameMode)) throw new Error('replay: bad mode enum');

  const inputs = d.inputs;
  if (!Array.isArray(inputs)) throw new Error('replay: inputs not an array');
  if (inputs.length === 0 || inputs.length > MAX_TICKS) throw new Error('replay: bad tick length');
  for (let i = 0; i < inputs.length; i++) {
    const m = inputs[i];
    if (typeof m !== 'number' || !Number.isInteger(m) || m < 0 || m > ALL_INPUT_BITS) {
      throw new Error(`replay: bad input bits at tick ${i}`);
    }
  }
  return {
    header: { ...(h as unknown as ReplayHeader), startAt: startAt as StartAt },
    inputs: inputs as number[],
  };
}

/** UTF-8 byte length without Node Buffer (works in browser + Node). */
export function utf8Bytes(s: string): number {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(s).length;
  let n = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0) ?? 0;
    n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
  }
  return n;
}

export function parseReplayJson(text: string): ReplayFile {
  if (utf8Bytes(text) > MAX_BYTES) throw new Error('replay: file too large');
  return validateReplay(JSON.parse(text));
}

export function serializeReplay(header: ReplayHeader, inputs: number[]): string {
  return JSON.stringify({ header, inputs });
}

/** Shared replay-core construction: Story stages use the derived stage seed
 * plus carry, Practice uses the raw header seed/start point. UI playback and
 * this helper both build cores here so the two paths cannot drift. */
export function buildReplayCore(header: ReplayHeader, stageIndex: number, prevCarry: RunCarry | null): GameCore {
  const story = header.mode === 'story';
  const stageId = (story ? STAGE_ORDER[stageIndex]! : header.stageId) as StageId;
  return new GameCore({
    seed: story ? deriveStageSeed(header.seed, stageIndex) : header.seed,
    mode: header.mode === 'practice' ? 'practice' : 'story',
    startAt: story ? 'stage' : (header.startAt ?? 'stage'),
    stageId,
    difficulty: header.difficulty,
    playerId: header.playerId,
    shotId: header.shotType,
    ...(story && stageIndex > 0 && prevCarry ? { carry: copyRunCarry(prevCarry) } : {}),
  });
}

/** Deterministic playback: same header+inputs -> same final core.
 * Story consumes one continuous input array across stage boundaries
 * (carry transferred on clear); the returned core is the final stage core. */
export function playReplay(file: ReplayFile): GameCore {
  if (file.header.mode !== 'story') {
    const core = buildReplayCore(file.header, 0, null);
    for (const m of file.inputs) {
      if (!core.playing) break;
      core.step(m);
    }
    return core;
  }
  let carry: RunCarry | null = null;
  let idx = 0;
  let core = buildReplayCore(file.header, 0, null);
  for (let stageIndex = 0; stageIndex < STAGE_ORDER.length; stageIndex++) {
    while (idx < file.inputs.length) {
      if (!core.playing) break;
      core.step(file.inputs[idx]!);
      idx++;
    }
    if (core.phase === 'clear' && STAGE_ORDER[stageIndex + 1]) {
      carry = copyRunCarry(core);
      core = buildReplayCore(file.header, stageIndex + 1, carry);
      continue;
    }
    break;
  }
  return core;
}

/** Recorder collects masks passed to step(). */
export class Recorder {
  inputs: number[] = [];
  record(mask: number): void {
    this.inputs.push(mask & ALL_INPUT_BITS);
  }
}
