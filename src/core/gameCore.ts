// GameCore: deterministic 60Hz sim, Node-runnable (no DOM/browser APIs).
// Update order per tick: input/state -> wave/boss -> player/fire ->
// move -> collision -> item/score -> phase/end.
import { BALANCE as B } from './config.js';
import { Rng } from './rng.js';
import type { RunCarry } from './run.js';
import { INPUT, type DifficultyId, type GameMode, type PhaseKind } from './types.js';
import { BulletPool, segmentHitsCircle } from '../sim/bullets.js';
import { PATTERNS } from '../content/patterns.js';
import { STAGES, getBoss, getPlayer, getShot, type BossDef, type WaveDef } from '../content/data.js';

export interface CoreOptions {
  seed: number;
  mode: GameMode;
  stageId: string;
  difficulty: DifficultyId;
  playerId: string;
  shotId: string;
  /** practice start point */
  startAt?: 'stage' | 'midboss' | 'boss';
  /** story carry from the previous stage core (defensive copy applied) */
  carry?: RunCarry;
}

interface Enemy {
  active: boolean;
  type: string;
  x: number; y: number; px: number; py: number;
  hp: number; t: number;
  mov: string; pattern: string;
  /** lateral direction set once at spawn from the spawn side (-1 | 1) */
  moveDir: number;
  dropPower: number; dropPoint: number; score: number;
  radius: number;
  ttl: number; // ticks after spawn before the enemy retreats and flees
}

interface Item {
  active: boolean;
  kind: 'power' | 'point';
  x: number; y: number; px: number; py: number;
  vx: number; vy: number;
}

export interface SpellResult {
  boss: string;
  name: string;
  outcome: 'captured' | 'timeout' | 'failed';
}

export interface FinalState {
  tick: number;
  score: number;
  graze: number;
  lives: number;
  bombs: number;
  power: number;
  phase: PhaseKind;
  playerX: number;
  playerY: number;
  bossPhase: number;
  bulletsAlive: number;
  extendsAwarded: number[];
}

const START_X = 192;
const START_Y = 400;

export class GameCore {
  readonly opts: CoreOptions;
  readonly rng: Rng;
  tick = 0;

  phase: PhaseKind = 'stage';
  stageTick = 0;
  waveIdx = 0;

  // player
  px = START_X; py = START_Y;
  ppx = START_X; ppy = START_Y;
  power: number;
  lives: number = B.livesStart;
  bombs: number = B.bombsStart;
  invuln = 0;
  pendingDeath = -1; // >=0: deathbomb ticks remaining
  bombActive = 0;
  shotCd = 0;
  prevMask = 0;

  score = 0;
  graze = 0;
  extendsAwarded: boolean[] = [false, false, false];

  enemies: Enemy[] = [];
  items: Item[] = [];
  bullets = new BulletPool(B.enemyBulletPool);
  shots = new BulletPool(B.playerShotPool);

  boss: {
    def: BossDef;
    which: 'mid' | 'main';
    phaseIdx: number;
    phaseTick: number;
    hp: number;
    x: number; y: number;
    eligible: boolean;
  } | null = null;

  spellResults: SpellResult[] = [];
  clearBonus = 0;
  over = false;

  constructor(opts: CoreOptions) {
    // validate content IDs early (also done by replay import)
    if (!STAGES[opts.stageId]) throw new Error(`unknown stage ${opts.stageId}`);
    getPlayer(opts.playerId);
    getShot(opts.playerId, opts.shotId);
    this.opts = { ...opts };
    this.rng = new Rng(opts.seed);
    this.power = opts.mode === 'practice' ? B.powerMax : 0;
    if (opts.carry) {
      this.score = opts.carry.score;
      this.graze = opts.carry.graze;
      this.lives = opts.carry.lives;
      this.bombs = opts.carry.bombs;
      this.power = opts.carry.power;
      this.extendsAwarded = [...opts.carry.extendsAwarded];
    }
    for (let i = 0; i < B.enemyPool; i++) {
      this.enemies.push({ active: false, type: '', x: 0, y: 0, px: 0, py: 0, hp: 0, t: 0, mov: '', pattern: '', moveDir: 1, dropPower: 0, dropPoint: 0, score: 0, radius: 10, ttl: B.enemyTtl });
    }
    for (let i = 0; i < B.itemPool; i++) {
      this.items.push({ active: false, kind: 'point', x: 0, y: 0, px: 0, py: 0, vx: 0, vy: 0 });
    }
    const startAt = opts.startAt ?? 'stage';
    const stage = STAGES[opts.stageId]!;
    if (startAt === 'midboss') {
      this.phase = 'midboss';
      this.spawnBoss(stage.midbossId);
    } else if (startAt === 'boss') {
      this.phase = 'boss';
      this.spawnBoss(stage.bossId);
    }
  }

  get playing(): boolean {
    return this.phase !== 'clear' && this.phase !== 'gameover';
  }

  // ---- main step ----

  step(mask: number): void {
    mask &= 127;
    const bombPressed = (mask & INPUT.Bomb) !== 0 && (this.prevMask & INPUT.Bomb) === 0;

    if (this.playing) {
      this.tick++;
      this.updateWavesAndBoss(mask);
      this.updatePlayer(mask, bombPressed);
      this.moveAll();
      this.collide();
      this.updateItems();
      this.updatePhaseEnd();
    }
    this.prevMask = mask;
  }

  // ---- wave/boss ----

  private updateWavesAndBoss(_mask: number): void {
    if (this.phase === 'stage') {
      this.stageTick++;
      const stage = STAGES[this.opts.stageId]!;
      while (this.waveIdx < stage.waves.length && stage.waves[this.waveIdx]!.atTick <= this.stageTick) {
        this.spawnWave(stage.waves[this.waveIdx]!);
        this.waveIdx++;
      }
      for (const e of this.enemies) {
        if (!e.active) continue;
        e.t++;
        const pat = PATTERNS[e.pattern];
        // retreating/fleeing enemies stop firing
        if (pat && e.y > 0 && e.y < B.fieldH && e.t < e.ttl - B.retreatTicks) {
          pat({
            tick: this.tick, phaseTick: e.t, difficulty: this.opts.difficulty,
            emitter: e, playerX: this.px, playerY: this.py, rng: this.rng,
            spawn: (x, y, vx, vy, r, life) => this.bullets.spawn(x, y, vx, vy, r, life),
          });
        }
      }
    } else if (this.phase === 'midboss' || this.phase === 'boss') {
      const b = this.boss;
      if (!b) return;
      b.phaseTick++;
      const def = b.def.phases[b.phaseIdx]!;
      // boss drift
      if (def.kind === 'intro') {
        const k = Math.min(1, b.phaseTick / def.durationTicks);
        b.y = -20 + (110 + 20) * k;
        b.x = START_X;
      } else if (def.kind === 'exit') {
        b.y -= 1.2;
      } else {
        const mv = def.movement ?? 'fixed';
        if (mv === 'sideSweep') {
          b.x = START_X + 96 * Math.sin(this.tick * 0.011);
          b.y = 110;
        } else if (mv === 'pendulum') {
          b.x = START_X + 72 * Math.sin(this.tick * 0.009);
          b.y = 110 + 22 * Math.sin(this.tick * 0.018);
        } else {
          b.x = START_X;
          b.y = 110;
        }
        // active bosses stay centered on the playfield (never clamped offscreen)
        b.x = clamp(b.x, 24, B.fieldW - 24);
        b.y = clamp(b.y, 40, B.fieldH - 120);
      }
      const pat = def.pattern ? PATTERNS[def.pattern] : undefined;
      if (pat && (def.kind === 'normal' || def.kind === 'spell')) {
        pat({
          tick: this.tick, phaseTick: b.phaseTick, difficulty: this.opts.difficulty,
          emitter: b, playerX: this.px, playerY: this.py, rng: this.rng,
          spawn: (x, y, vx, vy, r, life) => this.bullets.spawn(x, y, vx, vy, r, life),
        });
      }
    }
  }

  private spawnWave(w: WaveDef): void {
    for (let i = 0; i < w.count; i++) {
      const slot = this.enemies.find((e) => !e.active);
      if (!slot) return; // pool full: ignore excess deterministically
      const jx = this.rng.range(-6, 6);
      slot.active = true;
      slot.type = w.enemy;
      slot.x = slot.px = w.x0 + i * w.dx + jx;
      slot.y = slot.py = w.y;
      slot.hp = w.hp;
      slot.moveDir = slot.x < B.fieldW / 2 ? 1 : -1;
      slot.t = -i * 12; // slight stagger for fire timing
      slot.mov = w.move;
      slot.pattern = w.pattern;
      slot.dropPower = w.dropPower;
      slot.dropPoint = w.dropPoint;
      slot.score = w.score;
      slot.radius = w.enemy === 'weaver' ? 12 : 9;
      slot.ttl = w.ttl ?? (w.move === 'hover' ? B.hoverTtl : B.enemyTtl);
    }
  }

  private spawnBoss(bossId: string): void {
    const def = getBoss(bossId, this.opts.difficulty);
    const stage = STAGES[this.opts.stageId]!;
    this.boss = {
      def, which: bossId === stage.bossId ? 'main' : 'mid', phaseIdx: 0, phaseTick: 0,
      hp: Math.max(1, def.phases[0]!.hp),
      x: START_X, y: -20, eligible: true,
    };
  }

  // ---- player/fire ----

  private updatePlayer(mask: number, bombPressed: boolean): void {
    const def = getPlayer(this.opts.playerId);
    const focused = (mask & INPUT.Focus) !== 0;

    if (this.pendingDeath >= 0) {
      // deathbomb window: X rising edge with stock cancels death.
      // pendingDeath counts down 8..0; bomb valid while >0 at step start,
      // i.e. up to the 8th post-hit tick. At 0 the window has expired.
      if (bombPressed && this.bombs > 0 && this.pendingDeath > 0) {
        this.bombs--;
        this.pendingDeath = -1;
        this.bullets.clear();
        this.bombActive = B.bombDuration;
        this.invuln = B.bombInvuln;
        if (this.boss) this.boss.eligible = false;
        return;
      }
      this.pendingDeath--;
      if (this.pendingDeath < 0) this.die();
      // no movement while pending death
      return;
    }

    if (bombPressed && this.bombActive <= 0 && this.bombs > 0) {
      this.bombs--;
      this.bullets.clear();
      this.bombActive = B.bombDuration;
      this.invuln = Math.max(this.invuln, B.bombInvuln);
      if (this.boss) this.boss.eligible = false;
    }

    // movement
    let dx = 0, dy = 0;
    if (mask & INPUT.Left) dx -= 1;
    if (mask & INPUT.Right) dx += 1;
    if (mask & INPUT.Up) dy -= 1;
    if (mask & INPUT.Down) dy += 1;
    if (dx !== 0 && dy !== 0) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
    const spd = focused ? def.speedLo : def.speedHi;
    this.px = clamp(this.px + dx * spd, 8, B.fieldW - 8);
    this.py = clamp(this.py + dy * spd, 8, B.fieldH - 8);

    if (this.invuln > 0) this.invuln--;
    if (this.bombActive > 0) {
      this.bombActive--;
      this.bombDamageTick();
    }

    // fire
    if (this.shotCd > 0) this.shotCd--;
    if ((mask & INPUT.Shot) !== 0 && this.shotCd <= 0) {
      this.fireShots(def.id, focused);
      const shot = getShot(this.opts.playerId, this.opts.shotId);
      this.shotCd = shot.interval;
    }
  }

  private fireShots(_playerId: string, focused: boolean): void {
    const shot = getShot(this.opts.playerId, this.opts.shotId);
    const stage = Math.min(4, Math.floor(this.power));
    const streams = shot.streams[stage]!;
    const spreadK = focused ? 0.45 : 1;
    for (const s of streams) {
      const sx = this.px + s.dx * spreadK;
      // slight homing: bend toward nearest target
      let vx = 0, vy = -shot.speed;
      if (s.slightHoming) {
        const t = this.nearestTarget(sx, this.py);
        if (t) {
          const ang = Math.atan2(t.y - this.py, t.x - sx) + Math.PI / 2;
          const bend = clamp(ang * 0.15, -0.12, 0.12);
          vx = Math.sin(bend) * shot.speed;
          vy = -Math.cos(bend) * shot.speed;
        }
      }
      this.shots.spawn(sx, this.py - 10, vx, vy, 4, 60, s.dmg * B.shotDamage);
    }
  }

  private nearestTarget(x: number, y: number): { x: number; y: number } | null {
    let best: { x: number; y: number } | null = null;
    let bd = Infinity;
    if (this.boss && this.bossActive()) {
      const d = (this.boss.x - x) ** 2 + (this.boss.y - y) ** 2;
      if (d < bd) { bd = d; best = this.boss; }
    }
    for (const e of this.enemies) {
      if (!e.active) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  private bossActive(): boolean {
    if (!this.boss) return false;
    const k = this.boss.def.phases[this.boss.phaseIdx]!.kind;
    return k === 'normal' || k === 'spell';
  }

  private bombDamageTick(): void {
    const dmg = B.bombDamagePerTick;
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.hp -= dmg;
      if (e.hp <= 0) this.killEnemy(e);
    }
    if (this.boss && this.bossActive()) this.damageBoss(dmg);
  }

  // ---- move ----

  private moveAll(): void {
    // enemies
    for (const e of this.enemies) {
      if (!e.active) continue;
      e.px = e.x; e.py = e.y;
      if (e.t >= e.ttl) {
        e.active = false; // fled: no score, no drops, never stalls the stage
        continue;
      }
      if (e.t >= e.ttl - B.retreatTicks) {
        e.y -= 2.0; // retreat upward
        if (e.y < -30) e.active = false;
        continue;
      }
      if (e.mov === 'driftDown') e.y += 0.7;
      else if (e.mov === 'sineDown') { e.y += 0.8; e.x += Math.sin((e.t + 200) * 0.05) * 0.8; }
      else if (e.mov === 'hover') {
        if (e.y < 120) e.y += 1.0;
        else e.x += Math.sin(e.t * 0.03) * 0.6;
      } else if (e.mov === 'diagonalDown') { e.y += 0.75; e.x += e.moveDir * 0.8; }
      else if (e.mov === 'crossField') { e.x += e.moveDir * 1.4; e.y += 0.15; }
      else if (e.mov === 'stopAndGo') { e.y += e.t % 180 < 90 ? 0.9 : 0.15; }
      else e.y += 0.7;
      if (e.y > B.fieldH + 30) e.active = false;
      if (e.x < -60 || e.x > B.fieldW + 60) e.active = false;
    }
    this.bullets.integrate(B.fieldW, B.fieldH, 32);
    this.shots.integrate(B.fieldW, B.fieldH, 32);
    // items fall
    for (const it of this.items) {
      if (!it.active) continue;
      it.px = it.x; it.py = it.y;
      const auto = this.py <= B.collectLineY && this.power >= B.collectMinPower;
      const dx = this.px - it.x, dy = this.py - it.y;
      const d2 = dx * dx + dy * dy;
      if (auto || d2 < 90 * 90) {
        const d = Math.sqrt(d2) || 1;
        const pull = auto ? 7 : 4;
        it.vx = (dx / d) * pull;
        it.vy = (dy / d) * pull;
      } else {
        it.vx *= 0.98;
        it.vy = Math.min(it.vy + 0.03, 2.0);
        if (it.vy < 1.2) it.vy = 1.2;
      }
      it.x += it.vx; it.y += it.vy;
      if (it.y > B.fieldH + 16) it.active = false;
    }
  }

  // ---- collision ----

  private collide(): void {
    const def = getPlayer(this.opts.playerId);
    // player shots vs enemies / boss (swept)
    for (let i = 0; i < this.shots.cap; i++) {
      if (this.shots.active[i] === 0) continue;
      const x0 = this.shots.x[i] - this.shots.vx[i];
      const y0 = this.shots.y[i] - this.shots.vy[i];
      const x1 = this.shots.x[i], y1 = this.shots.y[i];
      let consumed = false;
      for (const e of this.enemies) {
        if (!e.active) continue;
        if (segmentHitsCircle(x0, y0, x1, y1, e.x, e.y, e.radius + 4)) {
          e.hp -= this.shots.dmg[i];
          this.shots.kill(i);
          consumed = true;
          if (e.hp <= 0) this.killEnemy(e);
          break;
        }
      }
      if (consumed) continue;
      if (this.boss && this.bossActive()) {
        const b = this.boss;
        const rad = b.def.contactRadius + 4;
        if (segmentHitsCircle(x0, y0, x1, y1, b.x, b.y, rad)) {
          this.damageBoss(this.shots.dmg[i]);
          this.shots.kill(i);
        }
      }
    }

    // enemy bullets vs player: graze + hit (O(N))
    const vulnerable = this.invuln <= 0 && this.pendingDeath < 0 && this.bombActive <= 0;
    for (let i = 0; i < this.bullets.cap; i++) {
      if (this.bullets.active[i] === 0) continue;
      const dx = this.bullets.x[i] - this.px;
      const dy = this.bullets.y[i] - this.py;
      const rr = this.bullets.r[i];
      const d2 = dx * dx + dy * dy;
      const hitR = def.hitRadius + rr;
      if (vulnerable && d2 <= hitR * hitR) {
        this.bullets.kill(i);
        this.pendingDeath = B.deathbombWindow;
        if (this.boss) this.boss.eligible = false;
        continue;
      }
      if (this.bullets.grazed[i] === 0) {
        const gz = B.grazeRadius + rr;
        if (d2 <= gz * gz) {
          this.bullets.grazed[i] = 1;
          this.graze++;
          this.addScore(B.grazeScore);
        }
      }
    }

    // enemy contact vs player
    if (vulnerable && this.pendingDeath < 0) {
      for (const e of this.enemies) {
        if (!e.active) continue;
        const dx = e.x - this.px, dy = e.y - this.py;
        const rr = e.radius + def.hitRadius;
        if (dx * dx + dy * dy <= rr * rr) {
          this.pendingDeath = B.deathbombWindow;
          if (this.boss) this.boss.eligible = false;
          break;
        }
      }
      if (this.pendingDeath < 0 && this.boss && this.bossActive() && this.invuln <= 0) {
        const b = this.boss;
        const dx = b.x - this.px, dy = b.y - this.py;
        const rr = b.def.contactRadius + def.hitRadius;
        if (dx * dx + dy * dy <= rr * rr) {
          this.pendingDeath = B.deathbombWindow;
          b.eligible = false;
        }
      }
    }
  }

  private killEnemy(e: Enemy): void {
    if (!e.active) return; // no double processing within a tick
    e.active = false;
    this.addScore(e.score);
    for (let i = 0; i < e.dropPower; i++) this.dropItem(e.x, e.y, 'power');
    for (let i = 0; i < e.dropPoint; i++) this.dropItem(e.x, e.y, 'point');
  }

  private damageBoss(dmg: number): void {
    const b = this.boss;
    if (!b || !this.bossActive()) return;
    b.hp -= dmg;
    if (b.hp <= 0) this.advanceBossPhase(true);
  }

  private dropItem(x: number, y: number, kind: 'power' | 'point'): void {
    for (const it of this.items) {
      if (it.active) continue;
      it.active = true;
      it.kind = kind;
      it.x = it.px = x + this.rng.range(-8, 8);
      it.y = it.py = y;
      it.vx = this.rng.range(-0.6, 0.6);
      it.vy = 1.2;
      return;
    }
    // item pool full: ignore excess deterministically
  }

  // ---- items/score ----

  private updateItems(): void {
    for (const it of this.items) {
      if (!it.active) continue;
      const dx = it.x - this.px, dy = it.y - this.py;
      if (dx * dx + dy * dy <= 14 * 14) {
        it.active = false;
        if (it.kind === 'power') {
          this.power = Math.min(B.powerMax, this.power + B.powerSmallItem);
        } else {
          const frac = 1 - clamp(it.y / B.fieldH, 0, 1);
          const val = Math.round(B.pointBottom + (B.pointTop - B.pointBottom) * frac);
          this.addScore(val);
        }
      }
    }
  }

  addScore(n: number): void {
    this.score += n;
    for (let i = 0; i < B.extendThresholds.length; i++) {
      if (!this.extendsAwarded[i] && this.score >= B.extendThresholds[i]!) {
        this.extendsAwarded[i] = true;
        if (this.lives < B.maxLives) this.lives++;
      }
    }
  }

  // ---- phase/end ----

  private updatePhaseEnd(): void {
    if (this.phase === 'stage') {
      const stage = STAGES[this.opts.stageId]!;
      const anyEnemy = this.enemies.some((e) => e.active);
      if (this.stageTick >= stage.wavesEndTick && !anyEnemy) {
        this.phase = 'midboss';
        this.spawnBoss(stage.midbossId);
      } else if (this.stageTick >= stage.wavesEndTick + B.stageFailsafeTicks) {
        // failsafe: leftovers flee so a missed enemy can never stall the run
        for (const e of this.enemies) e.active = false;
        this.phase = 'midboss';
        this.spawnBoss(stage.midbossId);
      }
    } else if (this.phase === 'midboss' || this.phase === 'boss') {
      const b = this.boss;
      if (!b) return;
      const def = b.def.phases[b.phaseIdx]!;
      if (def.kind !== 'intro' && def.kind !== 'exit' && b.phaseTick >= def.durationTicks) {
        this.advanceBossPhase(false); // timeout
      } else if ((def.kind === 'intro' || def.kind === 'exit') && b.phaseTick >= def.durationTicks) {
        this.advanceBossPhase(true);
      }
    }
  }

  private advanceBossPhase(killed: boolean): void {
    const b = this.boss;
    if (!b) return;
    const def = b.def.phases[b.phaseIdx]!;
    if (def.kind === 'spell') {
      if (killed && b.eligible) {
        this.addScore(def.bonus ?? 0);
        this.spellResults.push({ boss: b.def.id, name: def.spellName ?? '', outcome: 'captured' });
      } else if (!killed) {
        this.spellResults.push({ boss: b.def.id, name: def.spellName ?? '', outcome: 'timeout' });
      } else {
        this.spellResults.push({ boss: b.def.id, name: def.spellName ?? '', outcome: 'failed' });
      }
    }
    this.bullets.clear();
    b.phaseIdx++;
    b.phaseTick = 0;
    if (b.phaseIdx >= b.def.phases.length) {
      // boss defeated
      this.addScore(b.def.killScore);
      // drop shower
      for (let i = 0; i < 8; i++) this.dropItem(b.x, b.y, i % 2 === 0 ? 'power' : 'point');
      this.boss = null;
      if (b.which === 'mid') {
        this.phase = 'boss';
        this.spawnBoss(STAGES[this.opts.stageId]!.bossId);
      } else {
        this.phase = 'clear';
        this.clearBonus = this.lives * 10000 + this.bombs * 5000;
        this.addScore(this.clearBonus);
        this.over = true;
      }
    } else {
      const nd = b.def.phases[b.phaseIdx]!;
      b.hp = Math.max(1, nd.hp);
      // A bomb (or pending death) carrying into a new Spell voids its bonus:
      // Spell bonus requires no-bomb for the whole Spell, including entry.
      if (nd.kind === 'spell') b.eligible = this.bombActive <= 0 && this.pendingDeath < 0;
    }
  }

  private die(): void {
    this.pendingDeath = -1;
    this.lives--;
    this.bullets.clear();
    if (this.boss) this.boss.eligible = false;
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.over = true;
      return;
    }
    this.power = Math.max(0, this.power - B.powerLossOnDeath);
    this.bombs = B.bombsStart;
    this.px = this.ppx = START_X;
    this.py = this.ppy = START_Y;
    this.invuln = B.respawnInvuln;
    this.bombActive = 0;
  }

  snapshot(): FinalState {
    return {
      tick: this.tick,
      score: this.score,
      graze: this.graze,
      lives: this.lives,
      bombs: this.bombs,
      power: this.power,
      phase: this.phase,
      playerX: Math.round(this.px * 1000) / 1000,
      playerY: Math.round(this.py * 1000) / 1000,
      bossPhase: this.boss ? this.boss.phaseIdx : -1,
      bulletsAlive: this.bullets.alive,
      extendsAwarded: this.extendsAwarded.map((v, i) => (v ? B.extendThresholds[i]! : -1)).filter((v) => v >= 0),
    };
  }

  /**
   * FNV-1a hash over the FULL deterministic state: tick, RNG, player,
   * enemies, boss, bullets, shots, items, score/phase bookkeeping.
   * Two runs with the same seed+inputs must produce equal digests;
   * bullet-count-only comparisons are not sufficient.
   */
  digest(): string {
    const r3 = (n: number): number => Math.round(n * 1000) / 1000;
    const parts: (string | number)[] = [
      this.tick, this.rng.state, this.score, this.graze,
      this.lives, this.bombs, r3(this.power), this.phase,
      r3(this.px), r3(this.py), this.invuln, this.pendingDeath,
      this.bombActive, this.shotCd, this.stageTick, this.waveIdx,
      this.extendsAwarded.map((v) => (v ? 1 : 0)).join(''),
    ];
    for (const e of this.enemies) {
      if (e.active) parts.push(`E${e.type}${r3(e.x)},${r3(e.y)},${r3(e.hp)},${e.t},${e.ttl}`);
    }
    const b = this.boss;
    if (b) {
      parts.push(`B${b.def.id}${b.which}${b.phaseIdx},${b.phaseTick},${r3(b.hp)},${r3(b.x)},${r3(b.y)},${b.eligible ? 1 : 0}`);
    }
    parts.push(`P${this.poolChecksum(this.bullets)}`);
    parts.push(`S${this.poolChecksum(this.shots)}`);
    for (const it of this.items) {
      if (it.active) parts.push(`I${it.kind}${r3(it.x)},${r3(it.y)},${r3(it.vx)},${r3(it.vy)}`);
    }
    for (const s of this.spellResults) parts.push(`R${s.boss}${s.name}${s.outcome}`);
    const str = parts.join('|');
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  private poolChecksum(p: BulletPool): string {
    let sx = 0, sy = 0;
    for (let i = 0; i < p.cap; i++) {
      if (p.active[i] === 0) continue;
      sx += p.x[i] * 1.3 + p.r[i];
      sy += p.y[i] * 7.1 + p.dmg[i];
    }
    return `${p.alive}:${Math.round(sx * 1000) / 1000},${Math.round(sy * 1000) / 1000}`;
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
