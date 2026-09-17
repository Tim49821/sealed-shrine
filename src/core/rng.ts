// Seeded uint32 RNG (spec §9). Mulberry32-style. No Math.random/Date.
// seed 0 is mapped to a nonzero constant so "seed 0" is defined behavior.
export const SEED_ZERO_REPLACEMENT = 0x9e3779b9;

export class Rng {
  state: number;

  constructor(seed: number) {
    this.state = (seed >>> 0) === 0 ? SEED_ZERO_REPLACEMENT : seed >>> 0;
  }

  nextUint32(): number {
    // normalize to uint32 on every step so state never drifts into float range
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }

  /** [0, 1) */
  next(): number {
    return this.nextUint32() / 4294967296;
  }

  /** [min, max) */
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }

  pick<T>(arr: readonly T[]): T {
    return arr[this.nextUint32() % arr.length] as T;
  }
}
