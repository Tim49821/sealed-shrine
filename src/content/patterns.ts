// Danmaku pattern combinators (spec §6). Pure logic: no DOM/Pixi/timer/random.
// A new Spell is added by registering here + content data, no BulletSystem change.
import type { Rng } from '../core/rng.js';
import type { DifficultyId } from '../core/types.js';

export interface Emitter {
  x: number;
  y: number;
}

export interface PatternCtx {
  tick: number; // global tick
  phaseTick: number; // ticks since phase start
  difficulty: DifficultyId;
  emitter: Emitter;
  playerX: number;
  playerY: number;
  rng: Rng;
  spawn: (x: number, y: number, vx: number, vy: number, r: number, life: number) => boolean;
}

export type PatternFn = (ctx: PatternCtx) => void;

function aimAngle(ex: number, ey: number, px: number, py: number): number {
  return Math.atan2(py - ey, px - ex);
}

function vel(angle: number, speed: number): [number, number] {
  return [Math.cos(angle) * speed, Math.sin(angle) * speed];
}

/** Per-difficulty numeric set: count/speed/interval/aim/structure all vary. */
export interface DiffNums {
  count: number;
  speed: number;
  interval: number;
  aimJitter: number; // radians of random spread on aimed shots
  extra?: string; // structural tag e.g. 'reverse' | 'double' | 'side'
}

function diffTable(base: Record<DifficultyId, DiffNums>): (d: DifficultyId) => DiffNums {
  return (d) => {
    const p = base[d];
    return {
      ...p,
      count: Math.max(1, Math.ceil(p.count * 0.8)),
      speed: p.speed * 0.85,
      interval: Math.round(p.interval * 1.2),
    };
  };
}

export const fanAim: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 3, speed: 1.6, interval: 70, aimJitter: 0.05 },
    normal: { count: 5, speed: 2.0, interval: 55, aimJitter: 0.04 },
    hard: { count: 7, speed: 2.4, interval: 45, aimJitter: 0.03, extra: 'side' },
    lunatic: { count: 9, speed: 2.8, interval: 36, aimJitter: 0.02, extra: 'side' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
  const spread = 0.16;
  for (let i = 0; i < P.count; i++) {
    const off = (i - (P.count - 1) / 2) * spread + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
    const [vx, vy] = vel(base + off, P.speed);
    ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 4, 600);
  }
  if (P.extra === 'side') {
    // hard+: side channels fire perpendicular jittered shots
    for (const s of [-1, 1]) {
      const [vx, vy] = vel(base + s * 1.1, P.speed * 0.8);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 600);
    }
  }
};

export const ringPlain: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 12, speed: 1.3, interval: 110, aimJitter: 0 },
    normal: { count: 18, speed: 1.6, interval: 95, aimJitter: 0 },
    hard: { count: 26, speed: 1.9, interval: 85, aimJitter: 0, extra: 'double' },
    lunatic: { count: 34, speed: 2.2, interval: 75, aimJitter: 0, extra: 'double' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const rot = ctx.rng.next() * Math.PI * 2;
  const rings = P.extra === 'double' ? 2 : 1;
  for (let k = 0; k < rings; k++) {
    const off = rot + (k * Math.PI) / rings;
    for (let i = 0; i < P.count; i++) {
      const a = off + (i / P.count) * Math.PI * 2;
      const [vx, vy] = vel(a, P.speed * (k === 0 ? 1 : 0.7));
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 4, 700);
    }
  }
};

export const spiralTwin: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 2, speed: 1.7, interval: 7, aimJitter: 0 },
    normal: { count: 2, speed: 1.9, interval: 6, aimJitter: 0 },
    hard: { count: 3, speed: 2.1, interval: 5, aimJitter: 0, extra: 'reverse' },
    lunatic: { count: 4, speed: 2.3, interval: 4, aimJitter: 0, extra: 'reverse' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const dir = P.extra === 'reverse' && Math.floor(ctx.phaseTick / 240) % 2 === 1 ? -1 : 1;
  const base = ctx.phaseTick * 0.11 * dir;
  for (let i = 0; i < P.count; i++) {
    const a = base + (i * Math.PI * 2) / P.count;
    const [vx, vy] = vel(a, P.speed);
    ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 600);
  }
};

export const burstDelay: PatternFn = (ctx) => {
  // delayed burst: telegraph pause then aimed 5-way; lunatic adds second wave
  const P = diffTable({
    easy: { count: 3, speed: 2.2, interval: 120, aimJitter: 0.06 },
    normal: { count: 5, speed: 2.5, interval: 105, aimJitter: 0.05 },
    hard: { count: 5, speed: 2.8, interval: 90, aimJitter: 0.04, extra: 'echo' },
    lunatic: { count: 7, speed: 3.1, interval: 80, aimJitter: 0.03, extra: 'echo' },
  })(ctx.difficulty);
  const cyc = ctx.phaseTick % P.interval;
  if (cyc !== P.interval - 1) return;
  const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
  for (let i = 0; i < P.count; i++) {
    const off = (i - (P.count - 1) / 2) * 0.14 + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
    const [vx, vy] = vel(base + off, P.speed);
    ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 4, 500);
  }
  if (P.extra === 'echo') {
    for (let i = 0; i < 3; i++) {
      const off = (i - 1) * 0.3;
      const [vx, vy] = vel(base + Math.PI + off, P.speed * 0.6);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 500);
    }
  }
};

/** Slow weaving aimed pair for stage fairies. */
export const weaveAim: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 1, speed: 1.8, interval: 90, aimJitter: 0.08 },
    normal: { count: 2, speed: 2.1, interval: 75, aimJitter: 0.06 },
    hard: { count: 3, speed: 2.4, interval: 60, aimJitter: 0.05 },
    lunatic: { count: 3, speed: 2.7, interval: 48, aimJitter: 0.04, extra: 'weave' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
  for (let i = 0; i < P.count; i++) {
    const off = (i - (P.count - 1) / 2) * 0.2 + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
    const [vx, vy] = vel(base + off, P.speed);
    ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 500);
  }
};

/** Stage 2 lantern motif: alternating side fans, always leaving one fixed gap. */
export const lanternCorridor: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 3, speed: 1.5, interval: 80, aimJitter: 0.03 },
    normal: { count: 5, speed: 1.9, interval: 65, aimJitter: 0.03 },
    hard: { count: 7, speed: 2.2, interval: 55, aimJitter: 0.02, extra: 'side' },
    lunatic: { count: 7, speed: 2.6, interval: 45, aimJitter: 0.02, extra: 'alternating' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const volley = Math.floor(ctx.phaseTick / P.interval);
  const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
  const lean = volley % 2 === 0 ? 0.35 : -0.35; // alternating corridor side
  const spread = 0.18;
  for (let i = 0; i < P.count; i++) {
    // easy: fixed center gap; lunatic: gap side alternates every volley
    const isGap = P.extra === 'alternating'
      ? (volley % 2 === 0 ? i === 0 : i === P.count - 1)
      : i === Math.floor(P.count / 2);
    if (isGap) continue;
    const off = (i - (P.count - 1) / 2) * spread + lean * 0.4 + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
    const [vx, vy] = vel(base + off, P.speed);
    ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 550);
  }
  if (P.extra === 'side' || P.extra === 'alternating') {
    for (const s of [-1, 1]) {
      const [vx, vy] = vel(base + s * 1.2, P.speed * 0.75);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3, 550);
    }
  }
};

/** Stage 3 river motif: two opposing diagonal streams crossing the field. */
export const currentCross: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 2, speed: 1.6, interval: 70, aimJitter: 0.04 },
    normal: { count: 3, speed: 2.0, interval: 60, aimJitter: 0.03 },
    hard: { count: 4, speed: 2.3, interval: 50, aimJitter: 0.02, extra: 'center' },
    lunatic: { count: 5, speed: 2.7, interval: 42, aimJitter: 0.02, extra: 'reverse' },
  })(ctx.difficulty);
  const cyc = ctx.phaseTick % P.interval;
  const bias = Math.atan2(ctx.playerY - ctx.emitter.y, ctx.playerX - ctx.emitter.x) - Math.PI / 2;
  const tilt = Math.max(-0.4, Math.min(0.4, bias));
  // hard+: delayed center aimed shot halfway through the beat
  if (P.extra && cyc === Math.floor(P.interval / 2)) {
    const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
    for (let i = 0; i < 3; i++) {
      const [vx, vy] = vel(base + (i - 1) * 0.16, P.speed * 1.05);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 550);
    }
    return;
  }
  if (cyc !== 0) return;
  const order = P.extra === 'reverse' && Math.floor(ctx.phaseTick / P.interval) % 2 === 1 ? -1 : 1;
  const open = ctx.difficulty === 'easy' ? 0.5 : ctx.difficulty === 'normal' ? 0.42 : 0.34;
  for (const s of [1, -1] as const) {
    const dir = (P.extra === 'reverse' ? s * order : s) as 1 | -1;
    for (let i = 0; i < P.count; i++) {
      const a = Math.PI / 2 + dir * open + tilt * 0.3 + (i - (P.count - 1) / 2) * 0.09
        + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
      const [vx, vy] = vel(a, P.speed);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 550);
    }
  }
};

/** Stage 4 bell motif: telegraphed rings on a fixed beat (20-tick visual pause). */
export const bellPulse: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 10, speed: 1.2, interval: 130, aimJitter: 0 },
    normal: { count: 14, speed: 1.5, interval: 110, aimJitter: 0 },
    hard: { count: 18, speed: 1.8, interval: 100, aimJitter: 0, extra: 'double' },
    lunatic: { count: 24, speed: 2.1, interval: 90, aimJitter: 0, extra: 'offset' },
  })(ctx.difficulty);
  const cyc = ctx.phaseTick % P.interval;
  if (cyc < 20 || cyc !== P.interval - 1) return; // telegraph pause, then one pulse
  const rot = Math.floor(ctx.phaseTick / P.interval) * 0.35 + ctx.rng.next() * 0.1;
  const rings = P.extra ? 2 : 1;
  for (let k = 0; k < rings; k++) {
    const off = rot + (k * Math.PI) / rings + (P.extra === 'offset' && k === 1 ? Math.PI / P.count : 0);
    for (let i = 0; i < P.count; i++) {
      const a = off + (i / P.count) * Math.PI * 2;
      const [vx, vy] = vel(a, P.speed * (k === 0 ? 1 : 0.65));
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 4, 700);
    }
  }
};

/** Stage 5 mirror motif: symmetric fans with a difficulty-sized center gap. */
export const mirrorPair: PatternFn = (ctx) => {
  const P = diffTable({
    easy: { count: 3, speed: 1.6, interval: 75, aimJitter: 0.03 },
    normal: { count: 4, speed: 1.9, interval: 62, aimJitter: 0.02 },
    hard: { count: 5, speed: 2.2, interval: 52, aimJitter: 0.02 },
    lunatic: { count: 5, speed: 2.5, interval: 44, aimJitter: 0.01, extra: 'spiral' },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const gap = ctx.difficulty === 'easy' ? 0.2 : ctx.difficulty === 'normal' ? 0.15 : 0.12;
  const spread = ctx.difficulty === 'easy' ? 0.34 : ctx.difficulty === 'normal' ? 0.2 : 0.16;
  for (const side of [-40, 40]) {
    const ex = ctx.emitter.x + side;
    const base = aimAngle(ex, ctx.emitter.y, ctx.playerX, ctx.playerY);
    for (let i = 0; i < P.count; i++) {
      const off = (i - (P.count - 1) / 2) * spread + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
      if (Math.abs(off) < gap) continue; // never a complete wall
      const [vx, vy] = vel(base + off, P.speed);
      ctx.spawn(ex, ctx.emitter.y, vx, vy, 3.5, 550);
    }
  }
  if (P.extra === 'spiral') {
    // lunatic only: reverse spiral pair from the center
    const dir = Math.floor(ctx.phaseTick / P.interval) % 2 === 0 ? 1 : -1;
    for (const s of [0, Math.PI]) {
      const a = ctx.phaseTick * 0.07 * dir + s;
      const [vx, vy] = vel(a, P.speed * 0.8);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3, 550);
    }
  }
};

/** Stage 6 composite: short motifs of stages 2-5 in rotation, two combined late. */
export const vowComposite: PatternFn = (ctx) => {
  const CYCLE = 480;
  const q = Math.floor((ctx.phaseTick % CYCLE) / 120); // 0..3
  const inLastQuarter = (ctx.phaseTick % CYCLE) >= 360;
  const P = diffTable({
    easy: { count: 3, speed: 1.5, interval: 70, aimJitter: 0.03 },
    normal: { count: 4, speed: 1.8, interval: 60, aimJitter: 0.02 },
    hard: { count: 5, speed: 2.1, interval: 52, aimJitter: 0.02 },
    lunatic: { count: 6, speed: 2.4, interval: 46, aimJitter: 0.01 },
  })(ctx.difficulty);
  if (ctx.phaseTick % P.interval !== 0) return;
  const base = aimAngle(ctx.emitter.x, ctx.emitter.y, ctx.playerX, ctx.playerY);
  const fan = (lean: number, skipCenter: boolean): void => {
    for (let i = 0; i < P.count; i++) {
      if (skipCenter && i === Math.floor(P.count / 2)) continue;
      const off = (i - (P.count - 1) / 2) * 0.18 + lean + (ctx.rng.next() - 0.5) * 2 * P.aimJitter;
      const [vx, vy] = vel(base + off, P.speed);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 550);
    }
  };
  const cross = (): void => {
    const open = 0.4;
    const n = Math.max(2, P.count - 2);
    for (const s of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const a = Math.PI / 2 + s * open + (i - (n - 1) / 2) * 0.1;
        const [vx, vy] = vel(a, P.speed);
        ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 3.5, 550);
      }
    }
  };
  const ring = (): void => {
    const n = P.count * 3;
    const rot = ctx.phaseTick * 0.02;
    for (let i = 0; i < n; i++) {
      const [vx, vy] = vel(rot + (i / n) * Math.PI * 2, P.speed * 0.85);
      ctx.spawn(ctx.emitter.x, ctx.emitter.y, vx, vy, 4, 600);
    }
  };
  const mirror = (): void => {
    for (const side of [-40, 40]) {
      const ex = ctx.emitter.x + side;
      const b = aimAngle(ex, ctx.emitter.y, ctx.playerX, ctx.playerY);
      for (let i = 0; i < P.count; i++) {
        const off = (i - (P.count - 1) / 2) * 0.16;
        if (Math.abs(off) < 0.14) continue;
        const [vx, vy] = vel(b + off, P.speed);
        ctx.spawn(ex, ctx.emitter.y, vx, vy, 3.5, 550);
      }
    }
  };
  if (q === 0) fan(0.14, true);
  else if (q === 1) cross();
  else if (q === 2) ring();
  else mirror();
  if (inLastQuarter) cross(); // only the last quarter combines two motifs
};

export const PATTERNS: Record<string, PatternFn> = {
  fanAim,
  ringPlain,
  spiralTwin,
  burstDelay,
  weaveAim,
  lanternCorridor,
  currentCross,
  bellPulse,
  mirrorPair,
  vowComposite,
};
