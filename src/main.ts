// App shell: keyboard menus, fixed-timestep loop, replay wiring, storage.
// Gameplay determinism lives in GameCore; this file only samples input masks.
import { BALANCE as B } from './core/config.js';
import { GameCore } from './core/gameCore.js';
import { copyRunCarry, deriveStageSeed, STAGE_ORDER, type RunCarry, type StageId } from './core/run.js';
import { INPUT, type DifficultyId } from './core/types.js';
import { PLAYERS, STAGES } from './content/data.js';
import { getDialogue, getEnding, type DialogueLine, type DialogueMoment, type PlayerId } from './content/dialogue.js';
import {
  CONTENT_VERSION, GAME_VERSION, MAX_BYTES, REPLAY_SCHEMA_VERSION,
  Recorder, buildReplayCore, parseReplayJson, serializeReplay, type ReplayFile, type ReplayHeader,
} from './replay/replay.js';
import { Renderer, type Look, type Overlay } from './ui/renderer.js';
import { Sfx } from './ui/audio.js';
import { loadSave, saveHiscore, saveMuted, loadProgress, saveProgress, type ProgressV2 } from './ui/storage.js';
import { isFinalStoryStage, nextStoryStage, pauseItems, practiceStageIds, resultItemsFor, shouldSaveHiscore, wrapText, type ResultKind } from './ui/flow.js';

type Screen =
  | 'title' | 'difficulty' | 'player' | 'shot' | 'practiceStage' | 'practicePart'
  | 'stageCard' | 'dialogue' | 'ending' | 'game' | 'howto' | 'result';

interface Sel {
  isPractice: boolean;
  difficulty: DifficultyId;
  playerIdx: number;
  shotIdx: number;
  stageId: StageId;
  startAt: 'stage' | 'midboss' | 'boss';
}

const STEP_MS = 1000 / 60;
const MAX_CATCHUP = 5;

const sfx = new Sfx();
const save = loadSave();
sfx.volume = save.volume;
sfx.muted = save.muted;

const sel: Sel = { isPractice: false, difficulty: 'normal', playerIdx: 0, shotIdx: 0, stageId: 'stage1', startAt: 'stage' };
let progress: ProgressV2 = loadProgress();
let screen: Screen = 'title';
let menuIdx = 0;
let paused = false;
let pauseIdx = 0;
let resultIdx = 0;

let core: GameCore | null = null;
let recorder = new Recorder();
let runHeader: ReplayHeader | null = null;
let replayMode: ReplayFile | null = null;
let replayIdx = 0;
let held = 0;
let acc = 0;
let lastT = 0;
let fpsShow = 60;
let lastResult = '';
let lastResultKind: ResultKind = 'run';
// DEV-only deterministic combat fast-forward for browser QA. Applied as a pure
// function of sim state inside the fixed-timestep loop, so a live run and its
// replay take the exact same trajectory while the flag is on.
let qaAuto = false;
// Story run state (UI-only; GameCore stays dialogue/screen-free).
type DialogueNext = 'resumeCore' | 'nextStage' | 'ending' | 'result';
let stageIndex = 0;
let carry: RunCarry | null = null;
let dialogueLines: readonly DialogueLine[] = [];
let dialogueIdx = 0;
let dialogueNext: DialogueNext = 'resumeCore';
let endingLines: readonly DialogueLine[] = [];
let endingIdx = 0;
// frame-diff sound triggers (avoid per-frame spam)
let sndLives = -1;
let sndBombs = -1;
let sndSpells = -1;

function currentLook(): Look {
  const player = runHeader ? runHeader.playerId : playerId();
  const shot = runHeader ? runHeader.shotType : shotId();
  const stageId = core?.opts.stageId ?? runHeader?.stageId ?? 'stage1';
  return { playerId: player, shotId: shot, visualTheme: STAGES[stageId]?.visualTheme ?? 'mist' };
}

const renderer = new Renderer();

function playerId(): string { return PLAYERS[sel.playerIdx]!.id; }
function shotId(): string { return PLAYERS[sel.playerIdx]!.shots[sel.shotIdx]!.id; }

function newSeed(): number {
  return (Math.floor(Math.random() * 0xffffffff) >>> 0);
}

function liveStory(): boolean {
  return replayMode === null && runHeader !== null && runHeader.mode === 'story';
}

function runPlayerId(): PlayerId {
  const id = runHeader ? runHeader.playerId : playerId();
  return id === 'rin' ? 'rin' : 'aria';
}

function currentStageId(): StageId {
  if (runHeader && runHeader.mode === 'practice') return runHeader.stageId as StageId;
  return STAGE_ORDER[stageIndex] ?? 'stage1';
}

function startGame(): void {
  const seed = newSeed();
  if (sel.isPractice) {
    const header: ReplayHeader = {
      schemaVersion: REPLAY_SCHEMA_VERSION,
      gameVersion: GAME_VERSION,
      contentVersion: CONTENT_VERSION,
      seed,
      mode: 'practice',
      startAt: sel.startAt,
      stageId: sel.stageId,
      difficulty: sel.difficulty,
      playerId: playerId(),
      shotType: shotId(),
    };
    runHeader = header;
    recorder = new Recorder();
    replayMode = null;
    replayIdx = 0;
    sndLives = B.livesStart; sndBombs = B.bombsStart; sndSpells = 0;
    // Practice starts immediately with max power and no carry.
    core = new GameCore({
      seed, mode: 'practice', stageId: sel.stageId, difficulty: sel.difficulty,
      playerId: playerId(), shotId: shotId(), startAt: sel.startAt,
    });
    screen = 'game';
    paused = false;
    held = 0;
    return;
  }
  // Story: one header + one recorder span all six stages.
  runHeader = {
    schemaVersion: REPLAY_SCHEMA_VERSION,
    gameVersion: GAME_VERSION,
    contentVersion: CONTENT_VERSION,
    seed,
    mode: 'story',
    startAt: 'stage',
    stageId: 'stage1',
    difficulty: sel.difficulty,
    playerId: playerId(),
    shotType: shotId(),
  };
  recorder = new Recorder();
  replayMode = null;
  replayIdx = 0;
  stageIndex = 0;
  carry = null;
  sndLives = B.livesStart; sndBombs = B.bombsStart; sndSpells = 0;
  screen = 'stageCard';
  held = 0;
}

/** Build the combat core for the current story stage (carry only after stage 1). */
function beginStageCombat(): void {
  if (!runHeader) return;
  const stageId = STAGE_ORDER[stageIndex]!;
  core = new GameCore({
    seed: deriveStageSeed(runHeader.seed, stageIndex),
    mode: 'story',
    stageId,
    difficulty: runHeader.difficulty,
    playerId: runHeader.playerId,
    shotId: runHeader.shotType,
    ...(stageIndex > 0 && carry ? { carry: copyRunCarry(carry) } : {}),
  });
  screen = 'game';
  paused = false;
  held = 0; // never let card/dialogue keys stick into gameplay
}

function enterDialogue(moments: DialogueMoment[], next: DialogueNext): void {
  if (!runHeader) return;
  const stageId = currentStageId();
  const pid = runPlayerId();
  dialogueLines = moments.flatMap((m) => [...getDialogue(stageId, pid, m)]);
  dialogueIdx = 0;
  dialogueNext = next;
  screen = 'dialogue';
  held = 0;
}

function advanceDialogue(): void {
  dialogueIdx++;
  if (dialogueIdx < dialogueLines.length) return;
  held = 0;
  if (dialogueNext === 'resumeCore') {
    screen = 'game';
  } else if (dialogueNext === 'nextStage') {
    stageIndex++;
    screen = 'stageCard';
  } else if (dialogueNext === 'ending') {
    endingLines = getEnding(runPlayerId());
    endingIdx = 0;
    screen = 'ending';
  } else {
    enterResult();
  }
}

function advanceEnding(): void {
  endingIdx++;
  if (endingIdx < endingLines.length) return;
  // Live stage 6 post-dialogue: record only the selected player's ending flag.
  if (liveStory() && runHeader) {
    const pid = runPlayerId();
    progress = {
      maxClearedStage: progress.maxClearedStage,
      endingsSeen: { ...progress.endingsSeen, [pid]: true },
    };
    saveProgress(progress);
  }
  held = 0;
  enterResult();
}

/** Live story stage N clear: unlock stage N once (practice/replay never touch progress). */
function persistStageClear(): void {
  const cleared = (stageIndex + 1) as ProgressV2['maxClearedStage'];
  if (cleared > progress.maxClearedStage) {
    progress = { ...progress, maxClearedStage: cleared, endingsSeen: { ...progress.endingsSeen } };
    saveProgress(progress);
  }
}

function startReplayPlayback(file: ReplayFile): void {
  replayMode = file;
  replayIdx = 0;
  runHeader = file.header;
  recorder = new Recorder(); // not recorded; playback only
  stageIndex = 0;
  carry = null;
  core = buildReplayCore(file.header, 0, null);
  screen = 'game';
  paused = false;
  held = 0;
}

// ---------- menus ----------

function menuItems(): { title: string; items: string[] } {
  switch (screen) {
    case 'title':
      return { title: 'SEALED SHRINE (draft v0.2)', items: ['Story: Main Course', 'Practice', 'Watch Replay (import)', 'How to Play'] };
    case 'difficulty':
      return { title: 'SELECT DIFFICULTY', items: ['Easy', 'Normal', 'Hard', 'Lunatic'] };
    case 'player':
      return { title: 'SELECT CHARACTER (draft)', items: PLAYERS.map((p) => `${p.name} — ${p.epithet}`) };
    case 'shot':
      return { title: `SHOT TYPE — ${PLAYERS[sel.playerIdx]!.name}`, items: PLAYERS[sel.playerIdx]!.shots.map((s) => `${s.name}: ${s.desc}`) };
    case 'practiceStage': {
      const ids = practiceStageIds(progress);
      return { title: 'PRACTICE STAGE', items: ids.map((id) => `${id.toUpperCase()}: ${STAGES[id]!.name}`) };
    }
    case 'practicePart':
      return { title: 'PRACTICE START', items: ['Stage Start', 'Midboss', 'Boss'] };
    default:
      return { title: '', items: [] };
  }
}

function confirmMenu(): void {
  sfx.select();
  if (screen === 'title') {
    if (menuIdx === 0) { sel.isPractice = false; screen = 'difficulty'; menuIdx = 1; }
    else if (menuIdx === 1) { sel.isPractice = true; screen = 'difficulty'; menuIdx = 1; }
    else if (menuIdx === 2) importReplay();
    else if (menuIdx === 3) { screen = 'howto'; }
  } else if (screen === 'difficulty') {
    sel.difficulty = (['easy', 'normal', 'hard', 'lunatic'] as DifficultyId[])[menuIdx]!;
    screen = 'player'; menuIdx = 0;
  } else if (screen === 'player') {
    sel.playerIdx = menuIdx; sel.shotIdx = 0;
    screen = 'shot'; menuIdx = 0;
  } else if (screen === 'shot') {
    sel.shotIdx = menuIdx;
    if (sel.isPractice) { screen = 'practiceStage'; menuIdx = 0; }
    else { sel.stageId = 'stage1'; startGame(); }
  } else if (screen === 'practiceStage') {
    sel.stageId = practiceStageIds(progress)[menuIdx] ?? 'stage1';
    screen = 'practicePart'; menuIdx = 0;
  } else if (screen === 'practicePart') {
    sel.startAt = (['stage', 'midboss', 'boss'] as const)[menuIdx]!;
    startGame();
  } else if (screen === 'howto') {
    screen = 'title'; menuIdx = 0;
  }
}

function backMenu(): void {
  if (screen === 'difficulty') { screen = 'title'; menuIdx = 0; }
  else if (screen === 'player') { screen = 'difficulty'; menuIdx = 1; }
  else if (screen === 'shot') { screen = 'player'; menuIdx = sel.playerIdx; }
  else if (screen === 'practiceStage') { screen = 'shot'; menuIdx = sel.shotIdx; }
  else if (screen === 'practicePart') { screen = 'practiceStage'; menuIdx = 0; }
  else if (screen === 'howto') { screen = 'title'; menuIdx = 0; }
}

// ---------- input ----------

const KEY_BIT: Record<string, number> = {
  ArrowLeft: INPUT.Left, ArrowRight: INPUT.Right, ArrowUp: INPUT.Up, ArrowDown: INPUT.Down,
  KeyZ: INPUT.Shot, KeyX: INPUT.Bomb, ShiftLeft: INPUT.Focus, ShiftRight: INPUT.Focus,
};

function isGameKey(code: string): boolean {
  return code in KEY_BIT || ['Enter', 'Escape', 'Space', 'KeyM'].includes(code);
}

window.addEventListener('keydown', (e) => {
  if (isGameKey(e.code)) e.preventDefault();
  sfx.unlock();
  if (e.code === 'KeyM' && !e.repeat) {
    sfx.muted = !sfx.muted;
    save.muted = sfx.muted;
    saveMuted(sfx.muted);
    return;
  }
  const bit = KEY_BIT[e.code];
  if (bit !== undefined) held |= bit;

  if (e.repeat) return; // prevent key auto-repeat actions (bomb drain etc.)
  if (e.code === 'Escape') {
    if (screen === 'game') setPaused(!paused);
    else if (screen === 'result') { screen = 'title'; menuIdx = 0; }
    else backMenu();
    return;
  }
  if (screen === 'game') {
    if (paused) {
      const items = pauseItems(replayMode !== null);
      if (e.code === 'ArrowUp') { pauseIdx = (pauseIdx + items.length - 1) % items.length; sfx.select(); }
      else if (e.code === 'ArrowDown') { pauseIdx = (pauseIdx + 1) % items.length; sfx.select(); }
      else if (e.code === 'KeyZ' || e.code === 'Enter') {
        sfx.select();
        if (pauseIdx === 0) setPaused(false);
        else if (pauseIdx === 1) { startGameFromPause(); }
        else { screen = 'title'; menuIdx = 0; core = null; setPaused(false); }
      } else if (e.code === 'KeyX') {
        // X resumes too (matches the footer hint); never injects a bomb
        setPaused(false);
      }
    }
    return;
  }
  if (screen === 'result') {
    const items = resultItems();
    if (e.code === 'ArrowUp') { resultIdx = (resultIdx + items.length - 1) % items.length; sfx.select(); }
    else if (e.code === 'ArrowDown') { resultIdx = (resultIdx + 1) % items.length; sfx.select(); }
    else if (e.code === 'KeyZ' || e.code === 'Enter') confirmResult(items[resultIdx]!);
    else if (e.code === 'KeyX') { screen = 'title'; menuIdx = 0; }
    return;
  }
  if (screen === 'stageCard') {
    if (e.code === 'KeyZ' || e.code === 'Enter') {
      sfx.select();
      if (liveStory() || replayMode !== null) beginStageCombat();
      else { screen = 'game'; held = 0; }
    }
    return;
  }
  if (screen === 'dialogue') {
    // Z/Enter advances one line on a new keydown edge; X/Esc never skip.
    if (e.code === 'KeyZ' || e.code === 'Enter') { sfx.select(); advanceDialogue(); }
    return;
  }
  if (screen === 'ending') {
    if (e.code === 'KeyZ' || e.code === 'Enter') { sfx.select(); advanceEnding(); }
    return;
  }
  // list menus
  const { items } = menuItems();
  if (screen === 'howto') {
    if (e.code === 'KeyZ' || e.code === 'Enter' || e.code === 'KeyX') confirmMenu();
    return;
  }
  if (e.code === 'ArrowUp') { menuIdx = (menuIdx + items.length - 1) % items.length; sfx.select(); }
  else if (e.code === 'ArrowDown') { menuIdx = (menuIdx + 1) % items.length; sfx.select(); }
  else if (e.code === 'KeyZ' || e.code === 'Enter') confirmMenu();
  else if (e.code === 'KeyX') backMenu();
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
    // both Shifts share the Focus bit: keep it while either is still held
    if (!e.shiftKey) held &= ~INPUT.Focus;
    return;
  }
  const bit = KEY_BIT[e.code];
  if (bit !== undefined) held &= ~bit;
});

function setPaused(p: boolean): void {
  paused = p;
  pauseIdx = 0;
  held = 0; // never let menu/pause keys stick into gameplay (or vice versa)
}

window.addEventListener('blur', () => {
  held = 0; // never stick inputs
  if (screen === 'game' && core?.playing) setPaused(true);
});

document.addEventListener('visibilitychange', () => {
  acc = 0; // never burst-catch-up after hidden
  if (document.hidden) {
    held = 0;
    if (screen === 'game' && core?.playing) setPaused(true);
  }
});

function startGameFromPause(): void {
  if (replayMode && runHeader) {
    startReplayPlayback(replayMode);
  } else if (runHeader) {
    // restart same options with fresh seed
    startGame();
  }
}

// ---------- replay import/export ----------

function importReplay(): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.onchange = async () => {
    const f = input.files?.[0];
    if (!f) return;
    try {
      if (f.size > MAX_BYTES) throw new Error('replay: file too large');
      const text = await f.text();
      const file = parseReplayJson(text);
      startReplayPlayback(file);
    } catch (err) {
      lastResult = `Replay rejected: ${err instanceof Error ? err.message : err}`;
      lastResultKind = 'rejected';
      screen = 'result';
      resultIdx = 0;
      replayMode = null;
    }
  };
  input.click();
}

function downloadReplay(): void {
  if (!runHeader || (!replayMode && recorder.inputs.length === 0)) return;
  const inputs = replayMode ? replayMode.inputs : recorder.inputs;
  const blob = new Blob([serializeReplay(runHeader, inputs)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `replay-${runHeader.difficulty}-${runHeader.playerId}-${runHeader.seed.toString(16)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ---------- result ----------

function resultItems(): string[] {
  return resultItemsFor(lastResultKind);
}

function confirmResult(choice: string): void {
  sfx.select();
  if (choice === 'Retry' || choice === 'Watch Again') startGameFromPause();
  else if (choice === 'Save Replay (download)') downloadReplay();
  else { screen = 'title'; menuIdx = 0; core = null; }
}

function enterResult(): void {
  if (!core || !runHeader) return;
  const spells = core.spellResults.map((s) => `${s.name}: ${s.outcome}`).join('\n') || 'no spells';
  const ext = core.extendsAwarded.filter(Boolean).length;
  lastResult =
    `${core.phase === 'clear' ? 'STAGE CLEAR' : core.phase === 'gameover' ? 'GAME OVER' : 'REPLAY END'}\n` +
    `score ${core.score}   graze ${core.graze}\n` +
    `extends ${ext}   clearBonus ${core.clearBonus}\n` +
    `${spells}`;
  lastResultKind = replayMode ? 'replay' : 'run';
  if (shouldSaveHiscore({ isReplayPlayback: replayMode !== null, mode: runHeader.mode, phase: core.phase }) && core.score > save.hiscore) {
    save.hiscore = core.score;
    saveHiscore(core.score);
  }
  screen = 'result';
  resultIdx = 0;
}

// ---------- HUD ----------

function hudString(): string {
  const L: string[] = [];
  L.push(`HI ${save.hiscore}`);
  if (core) {
    const b = core.boss;
    L.push(`SC ${core.score}`);
    L.push(`PW ${core.power.toFixed(2)} (st${Math.floor(core.power)})`);
    L.push(`LIVES ${core.lives} (incl.you)`);
    L.push(`BOMB ${core.bombs}`);
    L.push(`GRAZE ${core.graze}`);
    L.push(`${core.opts.difficulty.toUpperCase()}`);
    const idx = STAGE_ORDER.indexOf(core.opts.stageId as StageId);
    L.push(idx >= 0 ? `STAGE ${idx + 1}/6` : core.opts.stageId.toUpperCase());
    L.push(`${b ? bossLine(core) : core.phase.toUpperCase()}`);
    L.push(`T ${Math.floor(core.tick / 60)}s`);
    const bs = renderer.lastBulletSync;
    L.push(`BLT ${core.bullets.alive}/${core.bullets.peak}-${core.bullets.dropped} r${bs.shown}${bs.skipped > 0 ? `!SKIP${bs.skipped}` : ''}`);
    if (core.pendingDeath >= 0) L.push('! DEATHBOMB !');
    if (replayMode) L.push('[REPLAY]');
    if (core.opts.mode === 'practice') L.push(`[PRACTICE ${core.opts.startAt ?? 'stage'}]`);
  } else {
    L.push('STORY 1-6 (M2 DRAFT)');
    L.push('2 chars x 2 shots');
    L.push('4 difficulties');
  }
  L.push(`FPS ${fpsShow}`);
  L.push(`GFX ${renderer.rendererName}${renderer.isWebGL ? '' : ' !NOT WEBGL'}`);
  L.push(sfx.muted ? '[M] MUTED' : '[M] sound on');
  return L.join('\n');
}

function bossLine(c: GameCore): string {
  const b = c.boss!;
  const def = b.def.phases[b.phaseIdx]!;
  const left = Math.max(0, def.durationTicks - b.phaseTick);
  const t = `${Math.floor(left / 60)}.${Math.floor((left % 60) / 6)}`;
  const name = def.kind === 'spell' ? (def.spellName ?? 'SPELL') : b.def.name;
  const sub = def.kind === 'spell'
    ? `BONUS ${def.bonus} ${b.eligible ? 'GET?' : '--'} TIME ${t}`
    : `${def.kind.toUpperCase()} ${t}`;
  // HUD column is ~196px: wrap so long names never overflow the canvas
  return [...wrapText(name, 24), sub].join('\n');
}

function overlay(): Overlay | null {
  if (screen === 'game') {
    if (paused) {
      const items = pauseItems(replayMode !== null);
      return { title: replayMode ? 'PAUSED (replay)' : 'PAUSED', lines: items, selected: pauseIdx, footer: 'Z confirm · X/Esc resume' };
    }
    return null;
  }
  if (screen === 'stageCard') {
    const stageId = currentStageId();
    const n = STAGE_ORDER.indexOf(stageId) + 1;
    return {
      title: `STAGE ${n} / 6`,
      lines: [STAGES[stageId]!.name, '', 'Press Z / Enter to start'],
      selected: -1,
      footer: 'Z/Enter start',
    };
  }
  if (screen === 'dialogue') {
    const line = dialogueLines[dialogueIdx] ?? { speaker: '', text: '' };
    const body = wrapText(line.text, 58);
    const who = line.speaker ? line.speaker : '—';
    return {
      title: who,
      lines: [...body, '', `${Math.min(dialogueIdx + 1, dialogueLines.length)}/${dialogueLines.length}`],
      selected: -1,
      footer: 'Z/Enter next',
    };
  }
  if (screen === 'ending') {
    const line = endingLines[endingIdx] ?? { speaker: '', text: '' };
    const body = wrapText(line.text, 58);
    const who = line.speaker ? line.speaker : '—';
    return {
      title: `ENDING — ${runPlayerId().toUpperCase()}`,
      lines: [who, ...body, '', `${Math.min(endingIdx + 1, endingLines.length)}/${endingLines.length}`],
      selected: -1,
      footer: 'Z/Enter result',
    };
  }
  if (screen === 'result') {
    // Narrow wrap keeps long Spell lines left of the HUD panel (overlay
    // starts at x=70; the HUD begins near x=418, so ~40 chars max).
    const body = wrapText(lastResult, 40);
    return { title: 'RESULT', lines: [...body, '', ...resultItems()], selected: body.length + 1 + resultIdx, footer: 'Z confirm · X title' };
  }
  if (screen === 'howto') {
    return {
      title: 'HOW TO PLAY (draft)',
      lines: [
        'Arrows: move (Shift: focus/slow)',
        'Z: shot / confirm (hold)',
        'X: bomb (rising edge only)',
        'After hit: press X within 8 ticks',
        '  to deathbomb (if bombs left).',
        'Top line + Power>=2.00: auto-collect.',
        'Graze: +100 each (once per bullet).',
        'Esc: pause. M: mute.',
        '',
        'Press Z to go back.',
      ],
      selected: -1,
      footer: '',
    };
  }
  const { title, items } = menuItems();
  const extra = screen === 'title'
    ? ['—', `HI ${save.hiscore} · STORY 1-6 + PRACTICE (DRAFT)`, 'Extra: not in M2']
    : screen === 'shot'
      ? ['—', 'Power stages change streams.', 'Focus tightens spread.']
      : [];
  return { title, lines: [...items, ...extra], selected: menuIdx, footer: 'Z/Enter confirm · X/Esc back' };
}

// ---------- loop ----------

function frame(t: number): void {
  requestAnimationFrame(frame);
  const dt = Math.min(250, t - (lastT || t));
  lastT = t;
  fpsShow = Math.round(1000 / Math.max(1, dt));
  acc += dt;
  let steps = 0;
  while (acc >= STEP_MS && steps < MAX_CATCHUP) {
    acc -= STEP_MS;
    steps++;
    if (screen === 'game' && core && !paused && core.playing) {
      if (qaAuto) {
        // DEV QA only: deterministic fast-forward as a pure function of state.
        const cc = core as unknown as { damageBoss(n: number): void };
        if (core.boss) {
          const kind = core.boss.def.phases[core.boss.phaseIdx]?.kind;
          if (kind === 'normal' || kind === 'spell') cc.damageBoss(1e9);
        } else if (core.phase === 'stage') {
          const st = STAGES[core.opts.stageId];
          if (st) core.stageTick = st.wavesEndTick + B.stageFailsafeTicks;
        }
      }
      let mask: number;
      if (replayMode) {
        if (replayIdx >= replayMode.inputs.length) {
          // inputs exhausted: stop at results, never pad with fake inputs
          enterResult();
        } else {
          mask = replayMode.inputs[replayIdx]!;
          replayIdx++;
          core.step(mask);
          if (!core.playing) {
            // Story replays cross deterministic clear boundaries with the
            // same carry/seed rule as live play; cards and dialogue are skipped.
            if (replayMode.header.mode === 'story' && core.phase === 'clear' && STAGE_ORDER[stageIndex + 1]) {
              carry = copyRunCarry(core);
              stageIndex++;
              core = buildReplayCore(replayMode.header, stageIndex, carry);
            } else {
              enterResult();
            }
          }
        }
      } else {
        mask = held;
        recorder.record(mask);
        const prevPhase = core.phase;
        const prevWhich = core.boss?.which ?? null;
        core.step(mask);
        if (liveStory()) {
          if (prevPhase === 'stage' && core.phase === 'midboss') {
            enterDialogue(['midbossBefore'], 'resumeCore');
          } else if (prevWhich === 'mid' && core.boss?.which === 'main') {
            enterDialogue(['midbossAfter', 'bossBefore'], 'resumeCore');
          } else if (core.phase === 'clear') {
            carry = copyRunCarry(core);
            persistStageClear();
            enterDialogue(['bossAfter'], isFinalStoryStage(currentStageId()) ? 'ending' : 'nextStage');
          } else if (!core.playing) {
            enterResult();
          }
        } else if (!core.playing) {
          enterResult();
        }
      }
      if (screen === 'game' && core) {
        // throttled sound triggers
        if (core.lives < sndLives) sfx.hit();
        if (core.bombs < sndBombs) sfx.bomb();
        if (core.spellResults.length > sndSpells) sfx.select();
        sndLives = core.lives; sndBombs = core.bombs; sndSpells = core.spellResults.length;
      }
    }
  }
  if (steps === MAX_CATCHUP) acc = 0; // drop backlog, no spiral
  renderer.draw(core, overlay(), hudString(), currentLook());
}

async function boot(): Promise<void> {
  const frameEl = document.getElementById('frame');
  if (!frameEl) throw new Error('missing #frame');
  await renderer.init(frameEl);
  // Development-only hooks for automated browser QA (screenshots + state asserts).
  // Never created in production builds. advanceCombat/autoAdvance only take
  // effect when explicitly invoked here; normal gameplay is untouched.
  if (import.meta.env.DEV) {
    const qaStrike = (): string => {
      if (!core || screen !== 'game') return 'idle';
      const c = core as unknown as { damageBoss(n: number): void };
      if (core.boss) {
        const kind = core.boss.def.phases[core.boss.phaseIdx]?.kind;
        if (kind === 'normal' || kind === 'spell') {
          c.damageBoss(1e9); // existing damage path, lethal
          return 'boss-hit';
        }
        return 'boss-transition';
      }
      if (core.phase === 'stage') {
        // jump to the existing failsafe boundary; pending waves spawn once
        // and flee through the failsafe so the stage can never stall
        const stage = STAGES[core.opts.stageId];
        if (stage) core.stageTick = stage.wavesEndTick + B.stageFailsafeTicks;
        return 'stage-skip';
      }
      return 'idle';
    };
    (window as unknown as { __qa?: object }).__qa = {
      screen: () => screen,
      menu: () => menuIdx,
      paused: () => paused,
      gfx: () => renderer.rendererName,
      tick: () => core?.tick ?? -1,
      phase: () => core?.phase ?? null,
      stageId: () => currentStageId(),
      stageIndex: () => stageIndex,
      score: () => core?.score ?? -1,
      carry: () => (carry ? { ...carry, extendsAwarded: [...carry.extendsAwarded] } : null),
      lives: () => core?.lives ?? -1,
      dialogue: () => (screen === 'dialogue' ? { idx: dialogueIdx, total: dialogueLines.length } : null),
      ending: () => (screen === 'ending' ? runPlayerId() : null),
      progress: () => ({ maxClearedStage: progress.maxClearedStage, endingsSeen: { ...progress.endingsSeen } }),
      practiceOptions: () => practiceStageIds(progress),
      advanceCombat: () => qaStrike(),
      setAutoAdvance: (on: boolean) => { qaAuto = on; },
      exportReplay: () => (runHeader ? serializeReplay(runHeader, replayMode ? replayMode.inputs : recorder.inputs) : null),
    };
  }
  requestAnimationFrame(frame);
}

void boot();
