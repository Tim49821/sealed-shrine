# M2 Main Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. In this repository the selected executor is an OpenCode `general` Task; it must preserve the same task-by-task test and review gates.

**Goal:** Extend the playable M1 Stage 1 into a deterministic six-stage Story with Practice unlocks, character-specific dialogue/endings, and full-run Replay support.

**Architecture:** Keep one `GameCore` per stage and carry only explicit run state between cores. Continue the existing registry-driven content model; add plain data and small shared movement/pattern functions rather than stage-number branches or a scripting DSL. `main.ts` owns UI-only Story/dialogue transitions, while combat remains browser-independent.

**Tech Stack:** TypeScript, Vite, PixiJS 8, Vitest, the existing cached Playwright Chromium driver.

**Spec:** `docs/design-v0.2.md`

## Global Constraints

- Preserve every M1 combat rule and acceptance test unless `docs/design-v0.2.md` explicitly changes it.
- Logical resolution remains exactly 640×480 with the 384×448 playfield and separate right HUD.
- Story order is exactly `stage1` through `stage6`; do not add `stage === N` engine branches.
- Keep Replay schemaVersion 2, set gameVersion `0.2.0`, and set contentVersion `main6-draft.1`.
- Story carries score, Graze, lives, bombs, Power, and awarded Extends; transient combat state resets.
- Enemy bullet capacity and renderer capacity remain exactly 8,192 with zero invisible active bullets.
- Add no dependency, server, database, laser system, event DSL, Continue, Extra, final BGM, achievement, or mid-run save.
- All names, dialogue, Spell names, and numeric content values are temporary M2 implementation values.
- Modify only this repository. Do not commit, push, deploy, access secrets, or request expanded OpenCode permissions.
- Use `apply_patch` for hand edits. Preserve unrelated user changes.

## File Map

- Create `src/core/run.ts`: Story stage order, `RunCarry`, carry copying, deterministic stage seed derivation.
- Create `src/content/stages.ts`: Stage 1–6 definitions and stage registry.
- Create `src/content/bosses.ts`: all midboss/main-boss definitions and boss registry.
- Create `src/content/dialogue.ts`: typed dialogue and ending data from design §8.
- Modify `src/content/data.ts`: retain player definitions and shared content types; re-export registries.
- Modify `src/content/patterns.ts`: five M2 pattern primitives/registrations.
- Modify `src/core/gameCore.ts`: carry initialization, three enemy movements, three boss movements.
- Modify `src/core/types.ts`: content ID types only if inferred literal types cannot be reused.
- Modify `src/ui/storage.ts`: versioned Practice/ending progress.
- Modify `src/ui/flow.ts`: pure Practice and Story navigation helpers.
- Create `src/ui/themes.ts`: pure stage-theme palette data.
- Modify `src/replay/replay.ts`: M2 versions and Stage 1–6 validation.
- Modify `src/ui/renderer.ts`: stage theme backgrounds, Stage Card/dialogue-safe overlays, M2 labels.
- Modify `src/main.ts`: Practice stage selection, dialogue, sequential stages, endings, full-run Replay.
- Modify `index.html`: M2 document title.
- Create `tests/run.test.ts`, `tests/content.test.ts`, and `tests/storage.test.ts`.
- Modify `tests/core.test.ts`, `tests/flow.test.ts`, `tests/replay.test.ts`, `tests/spriteSync.test.ts`.
- Modify `docs/qa/qa.mjs`: M2 browser flow and screenshots.
- Modify `README.md`; create `docs/implementation-report-m2.md`.

---

### Task 1: Deterministic Story Run State

**Files:**
- Create: `src/core/run.ts`
- Modify: `src/core/gameCore.ts`
- Create: `tests/run.test.ts`

**Interfaces:**
- Produces: `STAGE_ORDER`, `StageId`, `RunCarry`, `copyRunCarry(source)`, and `deriveStageSeed(runSeed, stageIndex)`.
- Produces: optional `carry?: RunCarry` on `CoreOptions`.
- Consumes: existing public `GameCore` score/Graze/lives/bombs/power/extends fields.

- [ ] **Step 1: Write failing seed and carry tests**

```ts
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
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/run.test.ts`

Expected: FAIL because `src/core/run.ts`, `carry`, and `stage2` do not exist.

- [ ] **Step 3: Implement the plain run helpers**

```ts
export const STAGE_ORDER = ['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6'] as const;
export type StageId = (typeof STAGE_ORDER)[number];

export interface RunCarry {
  score: number;
  graze: number;
  lives: number;
  bombs: number;
  power: number;
  extendsAwarded: boolean[];
}

export function copyRunCarry(source: RunCarry): RunCarry {
  return { ...source, extendsAwarded: [...source.extendsAwarded] };
}

export function deriveStageSeed(runSeed: number, stageIndex: number): number {
  let x = ((runSeed >>> 0) ^ Math.imul(stageIndex + 1, 0x9e3779b1)) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}
```

Add `carry?: RunCarry` to `CoreOptions`. In the constructor, initialize persistent fields from a defensive copy when present; otherwise retain the exact M1 Story/Practice defaults. Do not transfer position, `pendingDeath`, invulnerability, bomb duration, input edge, entities, bullets, items, boss, tick, or phase.

- [ ] **Step 4: Run Task 1 tests and the M1 core regression tests**

Run: `npx vitest run tests/run.test.ts tests/core.test.ts`

Expected: both files PASS; existing Deathbomb, Graze, Spell, pool, and RNG tests remain green.

- [ ] **Step 5: Review checkpoint**

Confirm the diff contains one plain data module and one constructor option, with no run-manager class, storage code, UI state, or stage-specific engine branch.

---

### Task 2: Six-Stage, Boss, Dialogue, and Ending Registries

**Files:**
- Create: `src/content/stages.ts`
- Create: `src/content/bosses.ts`
- Create: `src/content/dialogue.ts`
- Modify: `src/content/data.ts`
- Create: `tests/content.test.ts`

**Interfaces:**
- Consumes: `StageId` and `STAGE_ORDER` from Task 1.
- Produces: `StageVisualId`, `BossMovement`, extended `StageDef`/`BossPhaseDef`, `STAGES`, `getBoss`, `getDialogue`, `getEnding`, and dialogue/ending types.
- Preserves: `PLAYERS`, `getPlayer`, `getShot`, and current imports through `src/content/data.ts` re-exports.

- [ ] **Step 1: Write failing registry completeness tests**

```ts
import { describe, expect, it } from 'vitest';
import { STAGE_ORDER } from '../src/core/run.js';
import { STAGES, getBoss } from '../src/content/data.js';
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
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/content.test.ts`

Expected: FAIL because the M2 registry modules do not exist.

- [ ] **Step 3: Define the minimal shared content types**

Add exactly these concepts to `data.ts`:

```ts
export type StageVisualId = 'mist' | 'cedar' | 'river' | 'forge' | 'inverted' | 'seal';
export type BossMovement = 'fixed' | 'sideSweep' | 'pendulum';

export interface StageDef {
  id: StageId;
  name: string;
  visualTheme: StageVisualId;
  wavesEndTick: number;
  waves: WaveDef[];
  midbossId: string;
  bossId: string;
}

export interface BossPhaseDef {
  kind: 'intro' | 'normal' | 'spell' | 'exit';
  hp: number;
  durationTicks: number;
  pattern: string;
  movement?: BossMovement;
  spellName?: string;
  bonus?: number;
}
```

Move Stage definitions and boss builders to their focused files, then re-export `STAGE_ORDER`, `STAGES`, and `getBoss` from `data.ts` so existing M1 imports keep compiling.

- [ ] **Step 4: Populate exact Stage and boss data from the approved spec**

Implement Stage names, visual themes, wave-duration targets, wave counts, boss IDs, phase counts, and every Spell name from `docs/design-v0.2.md` §6–7. Use these required boss phase counts:

```ts
const MAIN_PHASE_COUNTS = {
  boss1: [2, 2], boss2: [2, 2], boss3: [2, 2],
  boss4: [2, 3], boss5: [3, 3], boss6: [3, 4],
} as const; // [normal, spell]
```

Use the existing difficulty HP helper and `[0.7, 1, 1.3, 1.6]`. Keep normal phases at 35–45 seconds, Spells at 45–55 seconds, and Stage 6 per-phase HP no higher than Stage 5. Give every midboss exactly intro + one normal + one Spell + exit.

- [ ] **Step 5: Populate typed dialogue and endings**

```ts
export type PlayerId = 'aria' | 'rin';
export type DialogueMoment = 'midbossBefore' | 'midbossAfter' | 'bossBefore' | 'bossAfter';
export interface DialogueLine { speaker: string; text: string }

export function getDialogue(stageId: StageId, playerId: PlayerId, moment: DialogueMoment): readonly DialogueLine[];
export function getEnding(playerId: PlayerId): readonly DialogueLine[];
```

Enter every approved line from design §8 verbatim. Reuse the same one-line midboss dialogue for both players. Endings use these exact narration beats:

```ts
aria: [
  { speaker: '', text: 'Aria는 봉인의 문을 완전히 닫지 않았다.' },
  { speaker: '', text: '일곱 밤마다 문은 잠시 열려, 오래된 맹세를 바람 속으로 돌려보냈다.' },
  { speaker: 'Aria', text: '가두는 대신 돌보면 돼. 다음 숨도 놓치지 않을게.' },
  { speaker: '', text: '마지막 조각 하나가 별빛을 따라 숲 너머로 사라졌다.' },
],
rin: [
  { speaker: '', text: 'Rin은 벽 대신 수많은 작은 길을 엮었다.' },
  { speaker: '', text: '주인을 기억한 조각은 돌아가고, 남은 기억은 새 이름을 찾아 흘렀다.' },
  { speaker: 'Rin', text: '보관함이 아니라 길표였어. 이제 막히지만 않으면 돼.' },
  { speaker: '', text: '설계도에 없던 조각 하나가 밤하늘의 빈칸으로 날아갔다.' },
],
```

- [ ] **Step 6: Run Task 2 tests and typecheck**

Run: `npx vitest run tests/content.test.ts tests/core.test.ts && npm run typecheck`

Expected: registry tests PASS and every existing import remains valid.

- [ ] **Step 7: Review checkpoint**

Confirm Stage/boss/dialogue content lives in registries, all names remain marked draft/temporary in docs, and no combat or UI logic was added to content files.

---

### Task 3: M2 Patterns and Movement Primitives

**Files:**
- Modify: `src/content/patterns.ts`
- Modify: `src/core/gameCore.ts`
- Modify: `tests/content.test.ts`
- Modify: `tests/core.test.ts`
- Modify: `tests/spriteSync.test.ts`

**Interfaces:**
- Consumes: `WaveDef.move`, `BossPhaseDef.movement`, and pattern IDs from Task 2.
- Produces pattern IDs: `lanternCorridor`, `currentCross`, `bellPulse`, `mirrorPair`, `vowComposite`.
- Produces movement IDs: `diagonalDown`, `crossField`, `stopAndGo`; boss movement behavior for `fixed`, `sideSweep`, `pendulum`.

- [ ] **Step 1: Add failing pattern registration and structure tests**

Add a test helper that runs one pattern for 1,200 phase ticks with a fixed RNG and records spawned `(vx, vy)` values. Assert every pattern referenced by every wave and boss phase exists in `PATTERNS`. For each new pattern, assert Easy and Lunatic differ in both spawn count and the set of rounded velocity angles.

```ts
expect(missingPatternIds()).toEqual([]);
expect(stats('bellPulse', 'lunatic').count).toBeGreaterThan(stats('bellPulse', 'easy').count);
expect(stats('bellPulse', 'lunatic').angles).not.toEqual(stats('bellPulse', 'easy').angles);
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run tests/content.test.ts tests/core.test.ts`

Expected: FAIL listing the five unregistered pattern IDs and three unsupported movement IDs.

- [ ] **Step 3: Implement five small pattern functions using existing helpers**

- `lanternCorridor`: alternating left/right fans with one fixed Easy gap; Hard adds a side fan; Lunatic alternates the gap side.
- `currentCross`: two opposing diagonal streams; Hard adds a delayed center shot; Lunatic reverses stream order every cycle.
- `bellPulse`: telegraphed rings at a fixed beat; Hard emits a second slower ring; Lunatic offsets the second ring by half a slot.
- `mirrorPair`: mirrored fans from symmetric emit offsets; keep a difficulty-sized center gap; Lunatic adds a reverse spiral pair.
- `vowComposite`: cycle through one short motif from the previous four patterns; combine only two motifs in the last quarter of the cycle.

Each function must use the existing `PatternCtx`, seeded RNG, and `ctx.spawn`; no new parser, object model, timer, or bullet movement type.

- [ ] **Step 4: Implement the six movement cases in existing update loops**

Add `moveDir: -1 | 1` to each pooled enemy slot and set it once at spawn from its initial side.
Use deterministic formulas only:

```ts
// enemy movement
diagonalDown: e.y += 0.75; e.x += e.moveDir * 0.8;
crossField: e.x += e.moveDir * 1.4; e.y += 0.15;
stopAndGo: e.y += e.t % 180 < 90 ? 0.9 : 0.15;

// boss movement after intro
fixed: x = 192; y = 110;
sideSweep: x = 192 + 96 * Math.sin(tick * 0.011); y = 110;
pendulum: x = 192 + 72 * Math.sin(tick * 0.009); y = 110 + 22 * Math.sin(tick * 0.018);
```

Allow ordinary enemies to enter/leave through existing offscreen margins. Clamp only active bosses so their
centers remain within the playfield. Preserve intro and exit movement exactly.

- [ ] **Step 5: Add the Stage 6 bullet-cap regression**

Run `vowComposite` with the Lunatic Stage 6 boss emitter for the longest 55-second Spell window. Integrate and expire bullets as `GameCore` does. Assert `peak <= 8192`, `dropped === 0`, and renderer sync reports `skipped === 0` for the peak active pool.

- [ ] **Step 6: Run pattern, core, and sprite tests**

Run: `npx vitest run tests/content.test.ts tests/core.test.ts tests/spriteSync.test.ts`

Expected: PASS with zero dropped/invisible Stage 6 bullets.

- [ ] **Step 7: Review checkpoint**

Confirm all content variation comes through registry data and five small pattern functions; there is no Stage-number switch, homing enemy bullet, acceleration system, laser, or DSL.

---

### Task 4: Versioned Progress and Practice Stage Selection

**Files:**
- Modify: `src/ui/storage.ts`
- Modify: `src/ui/flow.ts`
- Modify: `src/main.ts`
- Create: `tests/storage.test.ts`
- Modify: `tests/flow.test.ts`

**Interfaces:**
- Consumes: `STAGE_ORDER` and `StageId` from Task 1.
- Produces: `ProgressV2`, `DEFAULT_PROGRESS`, `parseProgress`, `loadProgress`, `saveProgress`, `practiceStageIds`.
- Produces UI screen: `practiceStage`; adds `stageId: StageId` to `Sel`.

- [ ] **Step 1: Write failing progress parsing and unlock tests**

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_PROGRESS, parseProgress } from '../src/ui/storage.js';
import { practiceStageIds } from '../src/ui/flow.js';

it('recovers invalid progress and accepts valid progress', () => {
  expect(parseProgress('{broken')).toEqual(DEFAULT_PROGRESS);
  expect(parseProgress('{"maxClearedStage":9,"endingsSeen":{"aria":true,"rin":false}}')).toEqual(DEFAULT_PROGRESS);
  expect(parseProgress('{"maxClearedStage":3,"endingsSeen":{"aria":true,"rin":false}}')).toEqual({ maxClearedStage: 3, endingsSeen: { aria: true, rin: false } });
});

it('shows only cleared Practice stages', () => {
  expect(practiceStageIds({ maxClearedStage: 1, endingsSeen: { aria: false, rin: false } })).toEqual(['stage1']);
  expect(practiceStageIds({ maxClearedStage: 4, endingsSeen: { aria: false, rin: false } })).toEqual(['stage1', 'stage2', 'stage3', 'stage4']);
});
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run: `npx vitest run tests/storage.test.ts tests/flow.test.ts`

Expected: FAIL because progress helpers do not exist.

- [ ] **Step 3: Implement one new versioned storage key**

```ts
export interface ProgressV2 {
  maxClearedStage: 1 | 2 | 3 | 4 | 5 | 6;
  endingsSeen: { aria: boolean; rin: boolean };
}
export const DEFAULT_PROGRESS: ProgressV2 = {
  maxClearedStage: 1,
  endingsSeen: { aria: false, rin: false },
};
const PROGRESS_KEY = 'ssd.progress.v2';
```

`parseProgress(text)` must require an integer 1–6 and exactly boolean `aria`/`rin` values. `loadProgress` and `saveProgress` must use the existing guarded backend and memory fallback. Do not replace or migrate hiscore/volume/muted keys.

- [ ] **Step 4: Add Practice Stage selection to the existing menu flow**

Flow after selecting a Practice shot becomes `practiceStage → practicePart → startGame`. Render `STAGES[id].name` for only `practiceStageIds(progress)`. Story always sets `sel.stageId = 'stage1'`; Practice uses the selected ID. Back navigation returns `practicePart → practiceStage → shot` without losing character/shot selection.

- [ ] **Step 5: Persist clears and ending flags at the correct boundary**

After a live Story Stage N clear, set `maxClearedStage = max(current, N)` and save once. After live Stage 6 post-dialogue, set only the selected player's ending flag. Practice and Replay must never modify progress.

- [ ] **Step 6: Run storage and flow tests**

Run: `npx vitest run tests/storage.test.ts tests/flow.test.ts && npm run typecheck`

Expected: PASS; current pause/result/hiscore/wrap tests remain green.

- [ ] **Step 7: Review checkpoint**

Confirm there is one new storage key, no achievement/mid-run save schema, and locked stages are absent rather than selectable placeholders.

---

### Task 5: Dialogue, Stage Cards, Sequential Story, and Endings

**Files:**
- Modify: `src/main.ts`
- Modify: `src/ui/flow.ts`
- Modify: `tests/flow.test.ts`

**Interfaces:**
- Consumes: Task 1 run helpers, Task 2 dialogue/endings, Task 4 progress functions.
- Produces screens: `stageCard`, `dialogue`, `ending`.
- Produces UI-only `DialogueNext = 'resumeCore' | 'nextStage' | 'ending' | 'result'`.

- [ ] **Step 1: Add failing pure transition tests**

Test exact helpers before touching DOM code:

```ts
expect(nextStoryStage('stage1')).toBe('stage2');
expect(nextStoryStage('stage5')).toBe('stage6');
expect(nextStoryStage('stage6')).toBeNull();
expect(isFinalStoryStage('stage6')).toBe(true);
expect(isFinalStoryStage('stage5')).toBe(false);
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/flow.test.ts`

Expected: FAIL because Story transition helpers do not exist.

- [ ] **Step 3: Implement pure stage-order helpers in `flow.ts`**

`nextStoryStage(id)` must look up `STAGE_ORDER.indexOf(id)` and return the next ID or null. `isFinalStoryStage(id)` is true only when no next ID exists. Do not duplicate a Stage array.

- [ ] **Step 4: Add Stage Card and dialogue state to `main.ts`**

Use plain variables, not a scene framework:

```ts
type DialogueNext = 'resumeCore' | 'nextStage' | 'ending' | 'result';
let stageIndex = 0;
let carry: RunCarry | null = null;
let dialogueLines: readonly DialogueLine[] = [];
let dialogueIdx = 0;
let dialogueNext: DialogueNext = 'resumeCore';
```

Z/Enter advances one line on a new keydown edge. Set `held = 0` when entering and leaving Stage Card, dialogue, or ending. Never call `GameCore.step()` or `Recorder.record()` outside `screen === 'game'`.

- [ ] **Step 5: Start each Story stage from deterministic run state**

Create the core with `stageId = STAGE_ORDER[stageIndex]`, `seed = deriveStageSeed(runHeader.seed, stageIndex)`, and the previous `carry` only after Stage 1. Stage Card precedes live Story stages. Practice starts immediately with no carry. Preserve the same run header and recorder across all six Story stages.

- [ ] **Step 6: Detect combat boundaries without teaching `GameCore` about dialogue**

Around each `core.step(mask)`, retain the previous `phase` and `boss?.which`:

- transition into midboss → pause on `midbossBefore`;
- transition from midboss to main boss → show `midbossAfter` followed by `bossBefore`;
- final main boss clear → copy carry, persist the cleared stage, then show `bossAfter`;
- Stage 1–5 post-dialogue → next Stage Card;
- Stage 6 post-dialogue → selected character ending, ending flag, then final result.

Practice skips every dialogue/Stage Card/ending. Replay skips them automatically and proceeds to the next core.

- [ ] **Step 7: Render all new screens through the existing `Overlay`**

Stage Card: Stage number + temporary name + `Z/Enter start`. Dialogue: speaker on title line, wrapped current text, and progress `n/total`. Ending: `ENDING — ARIA` or `ENDING — RIN`, one line at a time, then `Z/Enter result`. X/Esc does not skip dialogue; Esc still pauses only during `game`.

- [ ] **Step 8: Run flow, run-state, and core tests**

Run: `npx vitest run tests/flow.test.ts tests/run.test.ts tests/core.test.ts && npm run typecheck`

Expected: PASS with no M1 regression.

- [ ] **Step 9: Review checkpoint**

Confirm `GameCore` contains no dialogue sentence or screen state, `main.ts` contains no Stage-number behavior branch, and one Recorder/run header spans the complete Story.

---

### Task 6: Multi-Stage Replay Validation and Playback

**Files:**
- Modify: `src/replay/replay.ts`
- Modify: `src/main.ts`
- Modify: `tests/replay.test.ts`
- Modify: `tests/core.test.ts`

**Interfaces:**
- Consumes: `STAGE_ORDER`, `deriveStageSeed`, `RunCarry`, and Task 5 transition flow.
- Produces: M2 Replay constants and validation for Story Stage 1 or Practice Stage 1–6.
- Preserves: one `inputs: number[]` body, schemaVersion 2, 5MB, 216,000 ticks.

- [ ] **Step 1: Update tests first for exact M2 header rules**

```ts
expect(GAME_VERSION).toBe('0.2.0');
expect(CONTENT_VERSION).toBe('main6-draft.1');

for (const stageId of STAGE_ORDER) {
  const file = good();
  Object.assign(file.header as object, { mode: 'practice', stageId, startAt: 'boss' });
  expect(validateReplay(file).header.stageId).toBe(stageId);
}

const badStory = good();
Object.assign(badStory.header as object, { mode: 'story', stageId: 'stage2' });
expect(() => validateReplay(badStory)).toThrow(/story must start at stage1/);
```

Also change every valid fixture to gameVersion `0.2.0` and contentVersion `main6-draft.1`. Keep explicit tests rejecting the M1 content version, bad bits, oversized UTF-8, empty inputs, and invalid startAt.

- [ ] **Step 2: Run Replay tests and confirm RED**

Run: `npx vitest run tests/replay.test.ts`

Expected: FAIL on old version constants and the Stage 1-only validator.

- [ ] **Step 3: Implement exact validation rules**

- Story: only `stage1 + stage`.
- Practice: any `STAGE_ORDER` ID with `stage | midboss | boss`.
- Imported Replay ignores local Practice unlocks.
- schema v1 remains accepted only if it also matches M2 game/content versions; it defaults to `startAt: 'stage'`.

Use `STAGE_ORDER.includes(...)`; do not hard-code six `if` branches.

- [ ] **Step 4: Continue playback across deterministic Story boundaries**

When a replayed Story core clears and there is another stage, copy carry, increment `stageIndex`, construct the next core with `deriveStageSeed`, and continue consuming at the current `replayIdx`. Skip Stage Cards/dialogue/endings. Enter Replay result only on Stage 6 clear or input EOF. EOF must never pad zero inputs.

Practice Replay still ends when its one core ends. Restart Replay resets `stageIndex`, carry, core, and `replayIdx` to zero.

- [ ] **Step 5: Add deterministic transition coverage**

In `tests/core.test.ts`, construct the same six cores twice from seed 42, apply the same 120 deterministic masks per core, transfer carry, and compare a digest string containing stage index + core digest + carry. Assert the two complete sequences match and changing difficulty changes the result.

For every Stage ID and every Practice start point, keep the existing serialize → parse → playback digest comparison.

- [ ] **Step 6: Run Replay and full logic tests**

Run: `npx vitest run tests/replay.test.ts tests/core.test.ts tests/run.test.ts tests/flow.test.ts`

Expected: PASS; Story rules, all 18 Practice combinations, determinism, EOF, and hiscore isolation are covered.

- [ ] **Step 7: Review checkpoint**

Confirm the JSON shape did not change, no snapshots or stage delimiters were added, and M1 contentVersion files fail with a clear incompatibility error.

---

### Task 7: Procedural Stage Themes and M2-Safe UI

**Files:**
- Create: `src/ui/themes.ts`
- Modify: `src/ui/renderer.ts`
- Modify: `src/main.ts`
- Modify: `index.html`
- Modify: `tests/flow.test.ts`

**Interfaces:**
- Consumes: `StageVisualId` and `STAGES[core.opts.stageId].visualTheme`.
- Extends: `Look` with `visualTheme: StageVisualId`.
- Preserves: WebGL preference, world mask, sprite pools, 640×480 layout, zero per-frame background allocation.

- [ ] **Step 1: Add a failing theme lookup test**

Export a pure `themePalette(id)` from `src/ui/themes.ts`, returning `{ sky, ground, accent, motif }`
numeric/string values. Assert all six `StageVisualId` values resolve and are pairwise distinct by `accent`.

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `npx vitest run tests/flow.test.ts`

Expected: FAIL because theme lookup does not exist.

- [ ] **Step 3: Replace the one-time Stage 1 background with a cached theme layer**

Keep a `backgroundLayer: PIXI.Container` and `lastTheme: StageVisualId | ''`. On `Look.visualTheme` change, clear/destroy only that layer's children and draw the selected procedural motif once:

- `mist`: torii + stars (existing M1 drawing);
- `cedar`: dark vertical trunks + amber lantern points;
- `river`: horizontal water bands + upward pale streaks;
- `forge`: mountain silhouette + dull red furnace squares;
- `inverted`: mirrored shrine lines above/below center;
- `seal`: concentric broken rings + sparse glyph rectangles.

All motifs remain dark behind bullets. Do not create Graphics or textures on unchanged frames.

- [ ] **Step 4: Update M2 labels and overlay layout**

- HTML title: `Sealed Shrine (draft) — v0.2 M2`.
- HUD title: `draft v0.2 (M2)`.
- Title menu: `Story: Main Course` and no “Stage 1 only” message.
- HUD includes `STAGE n/6` using the current Stage index.
- Keep `hudText.y = 48`, WebGL backend line, 196px HUD wrap, 500px overlay wrap, and playfield mask.
- Stage Card, dialogue, ending, long Spell, and final result must stay inside 640×480.

- [ ] **Step 5: Run typecheck, UI helpers, and production build**

Run: `npx vitest run tests/flow.test.ts tests/spriteSync.test.ts && npm run typecheck && npm run build`

Expected: PASS; Vite output still uses relative `base: './'`.

- [ ] **Step 6: Review checkpoint**

Confirm the renderer still reads state only, background redraw occurs only on theme changes, and no final art/audio claim or dependency was introduced.

---

### Task 8: Full Verification, Browser QA, and Documentation

**Files:**
- Modify: `docs/qa/qa.mjs`
- Modify: `README.md`
- Create: `docs/implementation-report-m2.md`
- Modify only if needed for a verified defect: implementation/test files from Tasks 1–7

**Interfaces:**
- Consumes: complete M2 UI and existing `window.__qa` browser hook.
- Produces: reproducible QA driver, screenshots, README, actual implementation report.

- [ ] **Step 1: Extend development-only QA hooks for bounded automation**

Wrap `window.__qa` creation in `if (import.meta.env.DEV)`. Expose current `stageId`, dialogue
screen/index, ending ID, progress, and renderer backend. Add one clearly named `advanceCombat()` action:
for a stage phase it deactivates remaining enemies and advances to the existing failsafe boundary; for an
active boss phase it calls the existing damage path with lethal damage. It must not alter normal gameplay
unless explicitly invoked through the development-only hook.

- [ ] **Step 2: Rewrite the browser driver for the approved flow**

The driver must assert, in order:

1. boot/title and `gfx() === 'webgl'`;
2. Practice initially lists only Stage 1;
3. Story selection reaches Stage 1 Stage Card and game;
4. pause freezes tick, resume advances, restart resets the run;
5. scripted QA phase completion reaches each Stage 1→6 in order;
6. each Stage Card/theme, midboss/main-boss dialogue, and carry values are observed;
7. Stage 6 reaches the selected character ending and final result;
8. progress unlocks Stage 1~6 after the completed Story;
9. second character reaches a distinct Stage 6 ending;
10. Stage 6 starts under Easy/Normal/Hard/Lunatic Practice;
11. exported/imported full Story Replay reaches Stage 6 Replay result at EOF;
12. pageerror/console error list is empty.

Save screenshots for title, one mid-course Stage Card, one dialogue, Stage 6 gameplay, both endings, unlocked Practice, and Replay result under `docs/qa/` using stable `qa-m2-*.png` names.

- [ ] **Step 3: Run the complete automated verification fresh**

Run:

```bash
npm test
npm run typecheck
npm run build
npm run dev -- --host 127.0.0.1
node docs/qa/qa.mjs http://127.0.0.1:5173/
```

Expected: all tests PASS, typecheck/build exit 0, every browser assertion passes, WebGL is reported, and there are zero page errors. If local browser launch is sandbox-blocked, rerun only the server/browser commands with normal user approval; do not broaden OpenCode permissions.

- [ ] **Step 4: Inspect visual evidence**

Open the generated title, dialogue, Stage 6, ending, Practice, and Replay screenshots. Check text overlap/clipping, fixed 640×480 canvas, field mask, HUD title/body separation, distinct themes, long Spell wrapping, and visible bullets matching the active count.

- [ ] **Step 5: Update user documentation from actual results**

README must describe M2 as six main stages, two character endings, unlocked Practice, full-run Replay, current controls, exact commands, and M3 exclusions. `docs/implementation-report-m2.md` must state actual test counts, actual browser checks, actual content values, Replay incompatibility, known limits, and every deviation from `docs/design-v0.2.md`. Do not claim Extra, Continue, final art, BGM, or measured device FPS.

- [ ] **Step 6: Final scope and repository review**

Run: `git status --short`, `git diff --check`, and `rg -n "TODO|TBD|FIXME|Stage 1 only|not in M1" README.md docs src tests index.html`.

Expected: no accidental external/generated files, no whitespace errors, no stale M1-only UI copy, and no unresolved implementation placeholder. Preserve `docs/design-v0.1.md`, `docs/design-v0.2.md`, and this plan unchanged.

- [ ] **Step 7: Handoff without commit or deployment**

Report changed files, tests/typecheck/build/browser evidence, implemented M2 scope, known limits, and remaining M3 scope. Do not run git commit, push, Pages deployment, or any public action.
