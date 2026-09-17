// Pooled-sprite sync: assigns EVERY active pool entry to a sprite slot in
// fixed index order (no per-frame allocation; no skipping while slots remain).
// Sprite pools are sized == their sim pools, so `skipped` must stay 0 for
// gameplay pools. Node-runnable (structural sprite type), tested in
// tests/spriteSync.test.ts.
import type { BulletPool } from '../sim/bullets.js';

export interface Positionable {
  visible: boolean;
  position: { set(x: number, y: number): void };
  scale: { set(s: number): void };
}

export interface SyncStats {
  shown: number;
  skipped: number;
}

export function syncPoolSprites(
  sprites: Positionable[],
  pool: BulletPool,
  ox: number,
  oy: number,
  scaleDiv: number,
  prevShown: number,
): SyncStats {
  let shown = 0;
  let skipped = 0;
  for (let i = 0; i < pool.cap; i++) {
    if (pool.active[i] === 0) continue;
    if (shown < sprites.length) {
      const s = sprites[shown++]!;
      s.visible = true;
      s.position.set(ox + pool.x[i], oy + pool.y[i]);
      s.scale.set(pool.r[i] / scaleDiv);
    } else {
      skipped++;
    }
  }
  const hideTo = Math.min(prevShown, sprites.length);
  for (let i = shown; i < hideTo; i++) sprites[i]!.visible = false;
  return { shown, skipped };
}
