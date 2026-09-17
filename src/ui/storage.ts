// Versioned localStorage with fallback defaults; runnable when unavailable.
export interface SaveData {
  hiscore: number; // story mode only
  volume: number; // 0..1
  muted: boolean;
}

const HISCORE_KEY = 'ssd.hiscore.v1';
const VOLUME_KEY = 'ssd.volume.v1';
const MUTED_KEY = 'ssd.muted.v1';
const PROGRESS_KEY = 'ssd.progress.v2';

// ---- M2 story progress (design v0.2 §5.1). Temporary draft values. ----

export interface ProgressV2 {
  maxClearedStage: 1 | 2 | 3 | 4 | 5 | 6;
  endingsSeen: { aria: boolean; rin: boolean };
}

export const DEFAULT_PROGRESS: ProgressV2 = {
  maxClearedStage: 1,
  endingsSeen: { aria: false, rin: false },
};

/** Corrupt/missing/out-of-range values recover to DEFAULT_PROGRESS. */
export function parseProgress(text: string | null): ProgressV2 {
  try {
    if (text === null) return { ...DEFAULT_PROGRESS, endingsSeen: { ...DEFAULT_PROGRESS.endingsSeen } };
    const d = JSON.parse(text) as Record<string, unknown>;
    const n = d.maxClearedStage;
    const e = d.endingsSeen as Record<string, unknown> | undefined;
    if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > 6) return { ...DEFAULT_PROGRESS, endingsSeen: { ...DEFAULT_PROGRESS.endingsSeen } };
    if (typeof e !== 'object' || e === null || typeof e.aria !== 'boolean' || typeof e.rin !== 'boolean') {
      return { ...DEFAULT_PROGRESS, endingsSeen: { ...DEFAULT_PROGRESS.endingsSeen } };
    }
    return { maxClearedStage: n as ProgressV2['maxClearedStage'], endingsSeen: { aria: e.aria, rin: e.rin } };
  } catch {
    return { ...DEFAULT_PROGRESS, endingsSeen: { ...DEFAULT_PROGRESS.endingsSeen } };
  }
}

export function loadProgress(): ProgressV2 {
  try {
    return parseProgress(getBackend().get(PROGRESS_KEY));
  } catch {
    return { ...DEFAULT_PROGRESS, endingsSeen: { ...DEFAULT_PROGRESS.endingsSeen } };
  }
}

export function saveProgress(p: ProgressV2): void {
  try { getBackend().set(PROGRESS_KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

function memBackend(): Storage | null {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch { /* unavailable */ }
  return null;
}

const memFallback = new Map<string, string>();

function getBackend(): { get(k: string): string | null; set(k: string, v: string): void } {
  const ls = memBackend();
  if (ls) {
    return {
      get: (k) => { try { return ls.getItem(k); } catch { return null; } },
      set: (k, v) => { try { ls.setItem(k, v); } catch { /* ignore */ } },
    };
  }
  return {
    get: (k) => memFallback.get(k) ?? null,
    set: (k, v) => { memFallback.set(k, v); },
  };
}

export function loadSave(): SaveData {
  const b = getBackend();
  let hiscore = 0;
  let volume = 0.5;
  let muted = false;
  try {
    const h = b.get(HISCORE_KEY);
    if (h !== null) {
      const n = Number(h);
      if (Number.isFinite(n) && n >= 0) hiscore = Math.floor(n);
    }
    const v = b.get(VOLUME_KEY);
    if (v !== null) {
      const n = Number(v);
      if (Number.isFinite(n)) volume = Math.min(1, Math.max(0, n));
    }
    muted = b.get(MUTED_KEY) === '1';
  } catch { /* defaults */ }
  // legacy files may hold volume 0 from the old mute behavior (M1 review);
  // there is no volume slider, so 0 is indistinguishable from mute.
  if (!(volume > 0)) volume = 0.5;
  return { hiscore, volume, muted };
}

export function saveHiscore(v: number): void {
  try { getBackend().set(HISCORE_KEY, String(Math.floor(v))); } catch { /* ignore */ }
}

export function saveVolume(v: number): void {
  try { getBackend().set(VOLUME_KEY, String(v)); } catch { /* ignore */ }
}

export function saveMuted(m: boolean): void {
  try { getBackend().set(MUTED_KEY, m ? '1' : '0'); } catch { /* ignore */ }
}
