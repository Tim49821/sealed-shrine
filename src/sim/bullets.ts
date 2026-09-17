// Pooled typed-array bullets. No per-bullet allocation after init.
// Iteration order is fixed index order for determinism.
// ponytail: O(N) player-vs-bullets scan is fine for N<=8192 at 60Hz.
// Switch to a spatial grid only if enemy bullets exceed ~8k sustained AND
// profiling shows collision >2ms/frame; grid cell ~24px, rebuilt per tick.
export class BulletPool {
  readonly cap: number;
  x: Float32Array;
  y: Float32Array;
  vx: Float32Array;
  vy: Float32Array;
  r: Float32Array;
  dmg: Float32Array;
  life: Int32Array;
  active: Uint8Array;
  grazed: Uint8Array;
  cursor = 0;
  alive = 0;
  /** session peak alive (never reset by clear(); debug/pool policy) */
  peak = 0;
  /** spawns ignored because the pool was full (debug/pool policy) */
  dropped = 0;

  constructor(cap: number) {
    this.cap = cap;
    this.x = new Float32Array(cap);
    this.y = new Float32Array(cap);
    this.vx = new Float32Array(cap);
    this.vy = new Float32Array(cap);
    this.r = new Float32Array(cap);
    this.dmg = new Float32Array(cap);
    this.life = new Int32Array(cap);
    this.active = new Uint8Array(cap);
    this.grazed = new Uint8Array(cap);
  }

  clear(): void {
    this.active.fill(0);
    this.grazed.fill(0);
    this.alive = 0;
  }

  /** Deterministically ignores excess when full (round-robin cursor probe). */
  spawn(x: number, y: number, vx: number, vy: number, r: number, life: number, dmg = 0): boolean {
    for (let n = 0; n < this.cap; n++) {
      const i = (this.cursor + n) % this.cap;
      if (this.active[i] === 0) {
        this.active[i] = 1;
        this.grazed[i] = 0;
        this.x[i] = x;
        this.y[i] = y;
        this.vx[i] = vx;
        this.vy[i] = vy;
        this.r[i] = r;
        this.dmg[i] = dmg;
        this.life[i] = life;
        this.cursor = (i + 1) % this.cap;
        this.alive++;
        if (this.alive > this.peak) this.peak = this.alive;
        return true;
      }
    }
    this.dropped++;
    return false; // pool full: ignore excess deterministically
  }

  kill(i: number): void {
    if (this.active[i] === 1) {
      this.active[i] = 0;
      this.alive--;
    }
  }

  /** Move all; retire on life expiry or far outside field margin. */
  integrate(fieldW: number, fieldH: number, margin: number): void {
    const { x, y, vx, vy, life, active, cap } = this;
    for (let i = 0; i < cap; i++) {
      if (active[i] === 0) continue;
      x[i] += vx[i];
      y[i] += vy[i];
      life[i]--;
      if (
        life[i] <= 0 ||
        x[i] < -margin ||
        x[i] > fieldW + margin ||
        y[i] < -margin ||
        y[i] > fieldH + margin
      ) {
        active[i] = 0;
        this.alive--;
      }
    }
  }
}

/** Swept segment-circle test: does segment p0->p1 pass within rad of (cx,cy)? */
export function segmentHitsCircle(
  x0: number, y0: number, x1: number, y1: number,
  cx: number, cy: number, rad: number,
): boolean {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const l2 = dx * dx + dy * dy;
  let t = 0;
  if (l2 > 0) {
    t = ((cx - x0) * dx + (cy - y0) * dy) / l2;
    if (t < 0) t = 0;
    else if (t > 1) t = 1;
  }
  const px = x0 + dx * t - cx;
  const py = y0 + dy * t - cy;
  return px * px + py * py <= rad * rad;
}
