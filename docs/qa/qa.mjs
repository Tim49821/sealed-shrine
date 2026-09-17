// M2 browser QA driver (repo-local). Drives the dev server through the full
// Story (both characters), Practice unlocks, difficulty starts, and a full
// Story Replay import/playback. Uses the DEV-only window.__qa hook, including
// the deterministic setAutoAdvance fast-forward (same trajectory live and in
// replay, so the exported Story replay is exactly reproducible).
// Run: node docs/qa/qa.mjs [baseUrl]   (expects `npm run dev` on that URL)
// Exit non-zero on any failure. Screenshots land in docs/qa/ (repo-local only).
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const QA_DIR = join(dirname(fileURLToPath(import.meta.url)));
const BASE = process.argv[2] ?? 'http://127.0.0.1:5173/';
const PW = '/Users/ijaewon/.npm-user-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs';

const { chromium } = await import(PW);

const results = [];
const check = (name, ok, extra = '') => {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` (${extra})` : ''}`);
};

const browser = await chromium.launch({ headless: true, args: ['--disable-dev-shm-usage'] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const qa = (expr) => page.evaluate(`window.__qa.${expr}`);
const shot = (n) => page.screenshot({ path: join(QA_DIR, n) });
const sleep = (ms) => page.waitForTimeout(ms);
async function press(code, times = 1) {
  for (let i = 0; i < times; i++) {
    await page.keyboard.press(code);
    await sleep(160);
  }
}
async function waitScreen(s, timeout = 30000) {
  await page.waitForFunction((want) => window.__qa.screen() === want, s, { timeout });
}

/** Pump stageCard/dialogue/ending screens until result; observe the run. */
async function playStoryThrough(label, shots) {
  const cards = [];
  const dialogues = [];
  let ending = null;
  let lastCard = '';
  // The caller may already be inside stage combat (e.g. after the restart
  // check re-enters stage 1): seed the entered stage so the visit order
  // assertion covers the full 1->6 run instead of only observed cards.
  try {
    const entryScreen = await qa('screen()');
    if (entryScreen !== 'stageCard' && entryScreen !== 'title') {
      const entryStage = await qa('stageId()');
      if (entryStage) { cards.push(entryStage); lastCard = entryStage; }
    }
  } catch { /* fall through to observed cards only */ }
  const t0 = Date.now();
  for (;;) {
    if (Date.now() - t0 > 280000) throw new Error(`${label}: story timed out`);
    const s = await qa('screen()');
    if (s === 'result') break;
    if (s === 'gameover') throw new Error(`${label}: unexpected game over`);
    if (s === 'stageCard') {
      const id = await qa('stageId()');
      if (id !== lastCard) {
        cards.push(id);
        lastCard = id;
        if (id === 'stage3' && !shots.card) { shots.card = true; await shot('qa-m2-stagecard.png'); }
      }
      await press('z');
    } else if (s === 'dialogue') {
      const d = await qa('dialogue()');
      dialogues.push(`${await qa('stageId()')}:${d.idx + 1}/${d.total}`);
      if (!shots.dlg) { shots.dlg = true; await shot('qa-m2-dialogue.png'); }
      await press('z');
    } else if (s === 'ending') {
      ending = await qa('ending()');
      const n = ending === 'rin' ? 'qa-m2-ending-rin.png' : 'qa-m2-ending-aria.png';
      await shot(n);
      await press('z');
    } else if (s === 'game') {
      const id = await qa('stageId()');
      if (id === 'stage6' && !shots.s6) { shots.s6 = true; await sleep(1200); await shot('qa-m2-stage6.png'); }
      await sleep(200);
    } else {
      await sleep(200);
    }
  }
  return { cards, dialogues, ending };
}

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForFunction(() => window.__qa && window.__qa.gfx() !== 'unknown', null, { timeout: 20000 });
await sleep(800);

check('boot to title', (await qa(`screen()`)) === 'title');
check('webgl backend', (await qa(`gfx()`)) === 'webgl', await qa('gfx()'));
await shot('qa-m2-title.png');

// Practice initially lists only Stage 1
await press('ArrowDown'); // Practice
await press('z'); // difficulty
await press('z'); // normal -> player
await press('z'); // aria -> shot
await press('z'); // aria-a -> practiceStage
check('practice stage select shown', (await qa('screen()')) === 'practiceStage');
check('practice initially lists only stage1', JSON.stringify(await qa('practiceOptions()')) === JSON.stringify(['stage1']));
await shot('qa-m2-practice-locked.png');
await press('Escape', 4); // back to title through shot/player/difficulty
check('back to title', (await qa('screen()')) === 'title');

// Story selection reaches the Stage 1 Stage Card and game
await press('z'); // Story
await press('z'); // normal
await press('z'); // aria
await press('z'); // aria-a -> stageCard
check('story reaches stage card', (await qa('screen()')) === 'stageCard');
check('story starts at stage1', (await qa('stageId()')) === 'stage1');
await press('z'); // begin stage 1 combat (manual speed for the pause test)
await sleep(500);
check('story reaches game', (await qa('screen()')) === 'game');

// pause freezes tick, resume advances, restart resets the run
await page.waitForFunction(() => window.__qa.tick() > 50, null, { timeout: 20000 });
await press('Escape');
check('pause overlay', (await qa('paused()')) === true);
const tA = await qa('tick()');
await sleep(600);
check('pause freezes tick', (await qa('tick()')) === tA, `tick=${tA}`);
await press('z'); // resume
await sleep(600);
check('resume advances', (await qa('tick()')) > tA);
await press('Escape');
await press('ArrowDown'); // Restart
await press('z');
await sleep(400);
check('restart returns to stage card', (await qa('screen()')) === 'stageCard');
// deterministic fast-forward from here: same trajectory live and in replay
await qa('setAutoAdvance(true)');
await press('z'); // re-enter stage 1
await sleep(400);

// scripted QA completion reaches each Stage 1->6 in order
const shotsA = {};
const runA = await playStoryThrough('aria', shotsA);
check('story visits stages 1-6 in order',
  JSON.stringify(runA.cards) === JSON.stringify(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6']),
  runA.cards.join(','));
check('midboss/main-boss dialogue observed', runA.dialogues.length >= 24, `${runA.dialogues.length} lines`);
check('aria ending reached', runA.ending === 'aria', String(runA.ending));
check('aria result shown', (await qa('screen()')) === 'result');
await shot('qa-m2-result-aria.png');
const scoreA = await qa('score()');
check('story score carried', scoreA > 0, `score=${scoreA}`);
const progA = await qa('progress()');
check('progress unlocks stages 1-6', progA.maxClearedStage === 6, JSON.stringify(progA));
const replayJson = await qa('exportReplay()');
if (!replayJson) throw new Error('exportReplay returned null');
writeFileSync(join(QA_DIR, 'qa-m2-story.json'), replayJson);
check('story replay exported', replayJson.length > 100, `${replayJson.length} bytes`);

// second character reaches a distinct ending (result menu -> Back to Title)
{
  const s = await qa('screen()');
  if (s === 'result') {
    await press('ArrowDown', 2);
    await press('z');
    await sleep(400);
  }
}
check('back to title after story', (await qa('screen()')) === 'title');
await press('z'); // Story
await press('z'); // normal
await press('ArrowDown'); // rin
await press('z'); // rin -> shot
await press('z'); // rin-a -> stageCard
await press('z'); // begin combat (autoAdvance still on)
const runR = await playStoryThrough('rin', {});
check('rin ending reached', runR.ending === 'rin', String(runR.ending));
check('endings distinct', runA.ending !== runR.ending, `${runA.ending} vs ${runR.ending}`);
await press('ArrowDown', 2); // Back to Title from result
await press('z');
await sleep(400);

// unlocked Practice lists all six stages
await press('ArrowDown'); // Practice
await press('z'); // difficulty
await press('z'); // normal
await press('z'); // aria
await press('z'); // aria-a -> practiceStage
check('practice unlocks all six', JSON.stringify(await qa('practiceOptions()')) ===
  JSON.stringify(['stage1', 'stage2', 'stage3', 'stage4', 'stage5', 'stage6']));
await shot('qa-m2-practice-unlocked.png');

// Stage 6 starts under each difficulty (practice, stage start)
for (const [name, downs] of [['easy', 0], ['normal', 1], ['hard', 2], ['lunatic', 3]]) {
  await press('Escape', 4); // practiceStage -> title
  await sleep(300);
  await press('ArrowDown'); // Practice
  await press('z');
  await press('ArrowDown', downs);
  await press('z'); // difficulty -> player
  await press('z'); // aria -> shot
  await press('z'); // shot -> practiceStage
  await press('ArrowDown', 5); // stage6
  await press('z'); // -> practicePart
  await press('z'); // stage start -> game
  await sleep(800);
  check(`practice stage6 starts on ${name}`, (await qa('screen()')) === 'game' && (await qa('stageId()')) === 'stage6');
  await press('Escape'); // pause
  await press('ArrowDown', 2); // Quit to Title
  await press('z');
  await sleep(400);
}

// exported full Story Replay reaches the Stage 6 replay result at EOF
// Ensure we are on the title menu: Esc/pause-quit from game, X from result,
// Esc back-chain from submenus. Abort with the observed screen on failure.
for (let i = 0; i < 8 && (await qa('screen()')) !== 'title'; i++) {
  const s = await qa('screen()');
  if (s === 'game' && !(await qa('paused()'))) { await press('Escape'); }
  else if (s === 'game') { await press('ArrowDown', 2); await press('z'); }
  else if (s === 'result') { await press('x'); }
  else { await press('Escape'); }
  await sleep(300);
}
check('back to title before replay import', (await qa('screen()')) === 'title', await qa('screen()'));
await qa('setAutoAdvance(true)');
await press('ArrowDown', 2); // Watch Replay (import)
check('watch-replay selected', (await qa('menu()')) === 2, `menu=${await qa('menu()')}`);
let chooser = null;
try {
  [chooser] = await Promise.all([
    page.waitForEvent('filechooser', { timeout: 15000 }),
    press('z'),
  ]);
} catch (e) {
  check('replay file chooser opened', false, `screen=${await qa('screen()')} menu=${await qa('menu()')}`);
  throw e;
}
await chooser.setFiles(join(QA_DIR, 'qa-m2-story.json'));
await page.waitForFunction(() => window.__qa.screen() === 'result', null, { timeout: 280000 });
check('story replay reaches result at EOF', true);
await shot('qa-m2-replay-result.png');

check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
await browser.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} QA checks passed`);
if (failed.length > 0) process.exit(1);
