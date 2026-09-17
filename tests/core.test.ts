// Node-runnable logic tests (vitest). Covers spec §14 items 5-6.
import { describe, expect, it } from 'vitest';
import { BALANCE as B } from '../src/core/config.js';
import { GameCore } from '../src/core/gameCore.js';
import { INPUT } from '../src/core/types.js';
import { Rng } from '../src/core/rng.js';
import { BulletPool } from '../src/sim/bullets.js';
import { parseReplayJson, playReplay, serializeReplay, type ReplayFile } from '../src/replay/replay.js';
import { PATTERNS } from '../src/content/patterns.js';
import { STAGE_ORDER, deriveStageSeed, type RunCarry } from '../src/core/run.js';
import { syncPoolSprites } from '../src/ui/spriteSync.js';

function baseOpts(seed = 1234) {
  return {
    seed, mode: 'story' as const, stageId: 'stage1',
    difficulty: 'normal' as const, playerId: 'aria', shotId: 'aria-a',
  };
}

function hitPlayer(core: GameCore): void {
  core.invuln = 0;
  core.bombActive = 0;
  core.pendingDeath = -1;
  core.bullets.spawn(core.px, core.py, 0, 0, 4, 600);
  core.step(0);
}

describe('replay determinism', () => {
  it('same seed + inputs give same final snapshot', () => {
    const seed = 987654321;
    const inputs: number[] = [];
    let s = seed;
    for (let i = 0; i < 3600; i++) {
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
      inputs.push(s % 128);
    }
    const mk = (): GameCore => {
      const c = new GameCore(baseOpts(seed));
      for (const m of inputs) c.step(m);
      return c;
    };
    expect(mk().snapshot()).toEqual(mk().snapshot());
  });

  it('playReplay matches direct stepping', () => {
    const file: ReplayFile = {
      header: {
        schemaVersion: 2, gameVersion: '0.2.0', contentVersion: 'main6-draft.1',
        seed: 42, mode: 'story', startAt: 'stage', stageId: 'stage1',
        difficulty: 'hard', playerId: 'rin', shotType: 'rin-b',
      },
      inputs: Array.from({ length: 1200 }, (_, i) => (i % 3 === 0 ? INPUT.Shot : INPUT.Shot | INPUT.Focus)),
    };
    const a = playReplay(file);
    // M2 Story: live and replay cores both derive the stage seed.
    const b = new GameCore({
      seed: deriveStageSeed(42, 0), mode: 'story', stageId: 'stage1',
      difficulty: 'hard', playerId: 'rin', shotId: 'rin-b',
    });
    for (const m of file.inputs) b.step(m);
    expect(a.snapshot()).toEqual(b.snapshot());
    expect(a.digest()).toBe(b.digest());
  });

  it('story playReplay uses the derived stage seed, not the raw run seed', () => {
    const file: ReplayFile = {
      header: {
        schemaVersion: 2, gameVersion: '0.2.0', contentVersion: 'main6-draft.1',
        seed: 42, mode: 'story', startAt: 'stage', stageId: 'stage1',
        difficulty: 'normal', playerId: 'aria', shotType: 'aria-a',
      },
      inputs: Array.from({ length: 600 }, (_, i) => (i % 2 === 0 ? INPUT.Shot : 0)),
    };
    const a = playReplay(file);
    // live Story builds stage 1 with deriveStageSeed(runSeed, 0) (main.ts);
    // the replay helper must reproduce that exact core.
    const b = new GameCore({
      seed: deriveStageSeed(42, 0), mode: 'story', stageId: 'stage1',
      difficulty: 'normal', playerId: 'aria', shotId: 'aria-a',
    });
    for (const m of file.inputs) {
      if (!b.playing) break;
      b.step(m);
    }
    expect(a.digest()).toBe(b.digest());
  });

  it.each(['stage', 'midboss', 'boss'] as const)('practice startAt=%s round-trips through export/import', (startAt) => {
    const seed = 777;
    const core = new GameCore({ ...baseOpts(seed), mode: 'practice', startAt });
    const inputs: number[] = [];
    for (let i = 0; i < 900; i++) {
      const m = (i * 2654435761) % 128;
      inputs.push(m);
      if (core.playing) core.step(m);
    }
    const file: ReplayFile = {
      header: {
        schemaVersion: 2, gameVersion: '0.2.0', contentVersion: 'main6-draft.1',
        seed, mode: 'practice', startAt, stageId: 'stage1',
        difficulty: 'normal', playerId: 'aria', shotType: 'aria-a',
      },
      inputs,
    };
    // serialize -> parse -> play, as the UI does on import
    const parsed = parseReplayJson(serializeReplay(file.header, file.inputs));
    expect(parsed.header.startAt).toBe(startAt);
    const replayed = playReplay(parsed);
    expect(replayed.digest()).toBe(core.digest());
  });
});

describe('deathbomb window', () => {
  it('bomb on 8th post-hit tick survives without life loss', () => {
    const core = new GameCore(baseOpts());
    const bombs0 = core.bombs;
    hitPlayer(core);
    expect(core.pendingDeath).toBe(B.deathbombWindow);
    for (let i = 0; i < 7; i++) core.step(0);
    expect(core.pendingDeath).toBe(1);
    core.step(INPUT.Bomb);
    expect(core.lives).toBe(B.livesStart);
    expect(core.bombs).toBe(bombs0 - 1);
    expect(core.pendingDeath).toBe(-1);
  });

  it('bomb on 9th post-hit tick is rejected and death occurs exactly once', () => {
    const core = new GameCore(baseOpts());
    const bombs0 = core.bombs;
    hitPlayer(core);
    for (let i = 0; i < 8; i++) core.step(0);
    expect(core.pendingDeath).toBe(0);
    const lives0 = core.lives;
    core.step(INPUT.Bomb);
    expect(core.lives).toBe(lives0 - 1);
    expect(core.bombs).toBe(bombs0); // bomb not consumed
    expect(core.pendingDeath).toBe(-1);
  });
});

describe('graze dedup', () => {
  it('one bullet grazes at most once over its lifetime', () => {
    const core = new GameCore(baseOpts());
    core.invuln = 99999; // isolate graze from hits
    core.bullets.spawn(core.px + 10, core.py, 0, 0, 4, 600);
    for (let i = 0; i < 60; i++) core.step(0);
    expect(core.graze).toBe(1);
    expect(core.score).toBe(B.grazeScore);
  });

  it('a hitting bullet does not award graze on the hit tick', () => {
    const core = new GameCore(baseOpts());
    core.bullets.spawn(core.px, core.py, 0, 0, 4, 600);
    core.step(0);
    expect(core.graze).toBe(0);
    expect(core.pendingDeath).toBe(B.deathbombWindow);
  });
});

describe('pool reuse / excess policy', () => {
  it('ignores excess deterministically and reuses freed slots', () => {
    const pool = new BulletPool(8);
    for (let i = 0; i < 8; i++) expect(pool.spawn(i, 0, 0, 0, 1, 10)).toBe(true);
    expect(pool.alive).toBe(8);
    expect(pool.spawn(99, 0, 0, 0, 1, 10)).toBe(false);
    expect(pool.alive).toBe(8);
    pool.kill(3);
    expect(pool.spawn(99, 0, 0, 0, 1, 10)).toBe(true);
    expect(pool.alive).toBe(8);
    expect(pool.x[3]).toBe(99);
  });

  it('enemy bullet pool caps at configured size', () => {
    const core = new GameCore(baseOpts());
    for (let i = 0; i < B.enemyBulletPool + 100; i++) {
      core.bullets.spawn(100, 100, 0, 0, 3, 600);
    }
    expect(core.bullets.alive).toBe(B.enemyBulletPool);
  });
});

describe('extend thresholds', () => {
  it('crossing multiple thresholds at once awards each exactly once', () => {
    const core = new GameCore(baseOpts());
    core.addScore(700000);
    expect(core.lives).toBe(B.livesStart + 3);
    core.addScore(1000000);
    expect(core.lives).toBe(B.livesStart + 3); // no repeats
  });
});

describe('spell bonus eligibility', () => {
  function toSpell(core: GameCore): { before: number; bonus: number } {
    core.invuln = 99999;
    // finish intro
    const intro = core.boss!.def.phases[0]!.durationTicks;
    for (let i = 0; i < intro + 1; i++) core.step(0);
    expect(core.boss!.def.phases[core.boss!.phaseIdx]!.kind).toBe('normal');
    // kill normal -> enter spell
    (core as unknown as { damageBoss(n: number): void }).damageBoss(1e9);
    const idx = core.boss!.phaseIdx;
    expect(core.boss!.def.phases[idx]!.kind).toBe('spell');
    expect(core.boss!.eligible).toBe(true);
    return { before: core.score, bonus: core.boss!.def.phases[idx]!.bonus ?? 0 };
  }

  it('no-miss no-bomb in-time kill pays bonus', () => {
    const core = new GameCore({ ...baseOpts(), startAt: 'boss' });
    const { before, bonus } = toSpell(core);
    expect(bonus).toBeGreaterThan(0);
    (core as unknown as { damageBoss(n: number): void }).damageBoss(1e9);
    expect(core.spellResults[core.spellResults.length - 1]!.outcome).toBe('captured');
    expect(core.score).toBeGreaterThanOrEqual(before + bonus);
  });

  it('bomb during spell voids bonus', () => {
    const core = new GameCore({ ...baseOpts(), startAt: 'boss' });
    const { before } = toSpell(core);
    core.invuln = 0;
    core.pendingDeath = -1;
    core.bombActive = 0;
    const bombs0 = core.bombs;
    core.step(INPUT.Bomb); // rising edge, normal bomb
    expect(core.bombs).toBe(bombs0 - 1);
    expect(core.boss!.eligible).toBe(false);
    (core as unknown as { damageBoss(n: number): void }).damageBoss(1e9);
    expect(core.spellResults[core.spellResults.length - 1]!.outcome).toBe('failed');
    // score grew only by boss-phase kill shower/phase score, not the spell bonus:
    // bonus would be >= 100000; assert it was not added as a lump
    expect(core.score - before).toBeLessThan(100000);
  });

  it('bomb still active on spell entry voids bonus', () => {
    const core = new GameCore({ ...baseOpts(), startAt: 'boss' });
    core.invuln = 99999;
    const intro = core.boss!.def.phases[0]!.durationTicks;
    for (let i = 0; i < intro + 1; i++) core.step(0);
    expect(core.boss!.def.phases[core.boss!.phaseIdx]!.kind).toBe('normal');
    // bomb during normal, then kill it before the bomb expires
    core.invuln = 0;
    core.pendingDeath = -1;
    core.step(INPUT.Bomb);
    expect(core.bombActive).toBeGreaterThan(0);
    (core as unknown as { damageBoss(n: number): void }).damageBoss(1e9);
    expect(core.boss!.def.phases[core.boss!.phaseIdx]!.kind).toBe('spell');
    expect(core.boss!.eligible).toBe(false);
    const before = core.score;
    const bonus = core.boss!.def.phases[core.boss!.phaseIdx]!.bonus ?? 0;
    expect(bonus).toBeGreaterThan(0);
    (core as unknown as { damageBoss(n: number): void }).damageBoss(1e9);
    expect(core.spellResults[core.spellResults.length - 1]!.outcome).toBe('failed');
    expect(core.score - before).toBeLessThan(bonus);
  });
});

describe('stage progression', () => {
  it('hover waves retreat and the stage still reaches the midboss', () => {
    const core = new GameCore(baseOpts(2026));
    core.lives = 50; // survive stray hits while never shooting
    core.bombs = 50;
    let guard = 0;
    while (core.phase === 'stage' && guard < 12000) {
      core.step(0);
      guard++;
    }
    expect(core.phase).toBe('midboss');
    expect(core.boss!.def.id).toBe('midboss1');
    expect(core.tick).toBeLessThanOrEqual(4500 + B.stageFailsafeTicks);
  });

  it('boss content resolves through stage midbossId/bossId', () => {
    const mid = new GameCore({ ...baseOpts(), startAt: 'midboss' });
    expect(mid.boss!.def.id).toBe('midboss1');
    const boss = new GameCore({ ...baseOpts(), startAt: 'boss' });
    expect(boss.boss!.def.id).toBe('boss1');
  });
});

describe('M2 enemy movement primitives', () => {
  function loneEnemy(stageId: string, mov: string, x: number) {
    const core = new GameCore({ seed: 5, mode: 'story', stageId, difficulty: 'normal', playerId: 'aria', shotId: 'aria-a' });
    const e = core.enemies[0]!;
    e.active = true;
    e.type = 'mote';
    e.x = e.px = x;
    e.y = e.py = 100;
    e.hp = 100000;
    e.t = 10;
    e.mov = mov;
    e.pattern = '';
    e.ttl = 360000;
    e.radius = 9;
    (e as unknown as { moveDir: number }).moveDir = x < 192 ? 1 : -1;
    return { core, e };
  }

  it('diagonalDown falls and drifts sideways', () => {
    const { core, e } = loneEnemy('stage2', 'diagonalDown', 100);
    core.step(0);
    expect(e.y).toBeCloseTo(100.75, 6);
    expect(e.x).toBeCloseTo(100.8, 6);
  });

  it('crossField crosses fast with slight descent', () => {
    const { core, e } = loneEnemy('stage3', 'crossField', 60);
    core.step(0);
    expect(e.x).toBeCloseTo(61.4, 6);
    expect(e.y).toBeCloseTo(100.15, 6);
  });

  it('stopAndGo alternates fast and slow descent', () => {
    const fast = loneEnemy('stage4', 'stopAndGo', 150);
    fast.e.t = 10;
    fast.core.step(0);
    expect(fast.e.y).toBeCloseTo(100.9, 6);
    const slow = loneEnemy('stage4', 'stopAndGo', 150);
    slow.e.t = 100;
    slow.core.step(0);
    expect(slow.e.y).toBeCloseTo(100.15, 6);
  });

  it('boss movement stays inside the playfield', () => {
    for (const [stageId, startAt] of [['stage2', 'boss'], ['stage3', 'boss'], ['stage5', 'boss']] as const) {
      const core = new GameCore({ seed: 9, mode: 'story', stageId, difficulty: 'lunatic', playerId: 'rin', shotId: 'rin-a', startAt });
      core.invuln = 999999;
      for (let i = 0; i < 2500; i++) core.step(0);
      const b = core.boss!;
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.x).toBeLessThanOrEqual(B.fieldW);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeLessThanOrEqual(B.fieldH);
    }
  });
});

describe('M2 bullet-cap regression', () => {
  it('densest stage6 spell stays within the 8192 pool with zero drops', () => {
    const pool = new BulletPool(B.enemyBulletPool);
    const rng = new Rng(2026);
    const emitter = { x: 192, y: 110 };
    for (let t = 1; t <= 60 * 55; t++) {
      PATTERNS.vowComposite!({
        tick: t, phaseTick: t, difficulty: 'lunatic',
        emitter, playerX: 192, playerY: 400, rng,
        spawn: (x, y, vx, vy, r, life) => pool.spawn(x, y, vx, vy, r, life),
      });
      pool.integrate(B.fieldW, B.fieldH, 32);
    }
    expect(pool.peak).toBeLessThanOrEqual(8192);
    expect(pool.dropped).toBe(0);
    const slots = Array.from({ length: 8192 }, () => ({
      visible: false,
      position: { set: (_x: number, _y: number): void => undefined },
      scale: { set: (_v: number): void => undefined },
    }));
    const stats = syncPoolSprites(slots, pool, 0, 0, 8, 0);
    expect(stats.skipped).toBe(0);
    expect(stats.shown).toBe(pool.alive);
  });
});

describe('M2 full-story determinism', () => {
  function storyDigest(seed: number, difficulty: 'easy' | 'normal'): string {
    const parts: string[] = [];
    let c: RunCarry = { score: 0, graze: 0, lives: 3, bombs: 3, power: 0, extendsAwarded: [false, false, false] };
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const core = new GameCore({
        seed: deriveStageSeed(seed, i), mode: 'story', stageId: STAGE_ORDER[i]!,
        difficulty, playerId: 'aria', shotId: 'aria-a',
        ...(i > 0 ? { carry: { ...c, extendsAwarded: [...c.extendsAwarded] } } : {}),
      });
      for (let t = 0; t < 120; t++) core.step((t * 2654435761 + i * 97) % 128);
      c = {
        score: core.score, graze: core.graze, lives: core.lives,
        bombs: core.bombs, power: core.power, extendsAwarded: [...core.extendsAwarded],
      };
      parts.push(`${i}:${core.digest()}:${c.score},${c.graze},${c.lives},${c.bombs},${c.power}`);
    }
    return parts.join('|');
  }

  it('same seed+inputs give the same six-stage digest; difficulty changes it', () => {
    expect(storyDigest(42, 'normal')).toBe(storyDigest(42, 'normal'));
    expect(storyDigest(42, 'easy')).not.toBe(storyDigest(42, 'normal'));
  });

  it.each(STAGE_ORDER)('practice %s round-trips through export/import', (stageId) => {
    for (const startAt of ['stage', 'midboss', 'boss'] as const) {
      const seed = 4242;
      const core = new GameCore({ seed, mode: 'practice', stageId, difficulty: 'normal', playerId: 'rin', shotId: 'rin-a', startAt });
      const inputs: number[] = [];
      for (let i = 0; i < 300; i++) {
        const m = (i * 2654435761) % 128;
        inputs.push(m);
        if (core.playing) core.step(m);
      }
      const file: ReplayFile = {
        header: {
          schemaVersion: 2, gameVersion: '0.2.0', contentVersion: 'main6-draft.1',
          seed, mode: 'practice', startAt, stageId,
          difficulty: 'normal', playerId: 'rin', shotType: 'rin-a',
        },
        inputs,
      };
      const parsed = parseReplayJson(serializeReplay(file.header, file.inputs));
      expect(playReplay(parsed).digest()).toBe(core.digest());
    }
  });
});
describe('rng + digest', () => {
  it('state stays a uint32 and seed 0 is defined', () => {
    const r = new Rng(0);
    expect(r.state).not.toBe(0);
    let ok = true;
    for (let i = 0; i < 20000; i++) {
      const v = r.nextUint32();
      if (!Number.isInteger(r.state) || r.state < 0 || r.state >= 0x100000000 || v >= 0x100000000) {
        ok = false;
        break;
      }
    }
    expect(ok).toBe(true);
  });

  it('digest covers full state: same run equal, different difficulty differs', () => {
    const run = (difficulty: 'easy' | 'lunatic'): string => {
      const c = new GameCore({ ...baseOpts(99), difficulty });
      for (let i = 0; i < 1500; i++) c.step((i * 31) % 128);
      return c.digest();
    };
    expect(run('easy')).toBe(run('easy'));
    expect(run('easy')).not.toBe(run('lunatic'));
  });

  it('pool peak/dropped counters are tracked', () => {
    const pool = new BulletPool(4);
    for (let i = 0; i < 4; i++) pool.spawn(i, 0, 0, 0, 1, 10);
    pool.spawn(9, 0, 0, 0, 1, 10);
    pool.spawn(9, 0, 0, 0, 1, 10);
    expect(pool.peak).toBe(4);
    expect(pool.dropped).toBe(2);
  });

  it('3000+ live bullets survive stepping deterministically (render-stress sim side)', () => {
    const run = (): { alive: number; digest: string } => {
      const c = new GameCore(baseOpts(5150));
      c.lives = 50;
      c.invuln = 99999;
      for (let i = 0; i < 3000; i++) {
        c.bullets.spawn((i * 37) % 384, (i * 53) % 448, 0, 0, 4, 600);
      }
      for (let i = 0; i < 60; i++) c.step(0);
      return { alive: c.bullets.alive, digest: c.digest() };
    };
    const a = run();
    const b = run();
    expect(a.alive).toBe(3000);
    expect(a.digest).toBe(b.digest);
  });
});
