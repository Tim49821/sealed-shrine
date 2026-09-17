// spriteSync tests: every active sim entry must reach a sprite (item 13).
// Pools are sized == sim caps, so `skipped` must stay 0 for gameplay pools.
import { describe, expect, it } from 'vitest';
import { BulletPool } from '../src/sim/bullets.js';
import { syncPoolSprites, type Positionable } from '../src/ui/spriteSync.js';

function fakeSlots(n: number): Positionable[] {
  return Array.from({ length: n }, () => {
    const s = {
      visible: false, x: 0, y: 0, sc: 0,
      position: { set: (x: number, y: number): void => { s.x = x; s.y = y; } },
      scale: { set: (v: number): void => { s.sc = v; } },
    };
    return s;
  });
}

function fill(pool: BulletPool, n: number): void {
  for (let i = 0; i < n; i++) {
    pool.spawn((i * 37) % 384, (i * 53) % 448, 0, 0, 4, 600);
  }
}

describe('syncPoolSprites', () => {
  it('renders all 3000+ active bullets with zero skips (old 2048 cap regression)', () => {
    const pool = new BulletPool(8192);
    fill(pool, 3000);
    expect(pool.alive).toBe(3000);
    const stats = syncPoolSprites(fakeSlots(8192), pool, 24, 16, 8, 0);
    expect(stats).toEqual({ shown: 3000, skipped: 0 });
  });

  it('renders the full 8192 pool when saturated', () => {
    const pool = new BulletPool(8192);
    fill(pool, 8192);
    const stats = syncPoolSprites(fakeSlots(8192), pool, 0, 0, 8, 0);
    expect(stats).toEqual({ shown: 8192, skipped: 0 });
  });

  it('hides the tail when actives shrink', () => {
    const pool = new BulletPool(8192);
    fill(pool, 100);
    const slots = fakeSlots(8192);
    const first = syncPoolSprites(slots, pool, 0, 0, 8, 500);
    expect(first.shown).toBe(100);
    for (let i = 100; i < 500; i++) expect(slots[i]!.visible).toBe(false);
  });

  it('accounts skips instead of silently dropping when slots are short', () => {
    const pool = new BulletPool(8192);
    fill(pool, 3000);
    const stats = syncPoolSprites(fakeSlots(2048), pool, 0, 0, 8, 0);
    expect(stats).toEqual({ shown: 2048, skipped: 952 });
  });
});
