// Input bitmask (spec §9). Single source of truth for logic + replay.
export const INPUT = {
  Left: 1,
  Right: 2,
  Up: 4,
  Down: 8,
  Shot: 16,
  Bomb: 32,
  Focus: 64,
} as const;

export const ALL_INPUT_BITS = 1 | 2 | 4 | 8 | 16 | 32 | 64;

export type DifficultyId = 'easy' | 'normal' | 'hard' | 'lunatic';
export const DIFFICULTIES: DifficultyId[] = ['easy', 'normal', 'hard', 'lunatic'];

export type GameMode = 'story' | 'practice' | 'replay';
export const MODES: GameMode[] = ['story', 'practice', 'replay'];

export type PhaseKind = 'stage' | 'midboss' | 'boss' | 'clear' | 'gameover';

export interface Vec2 {
  x: number;
  y: number;
}
