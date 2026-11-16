import type { SavedMistakeRecord, Sm2Quality } from './types';

export const DAY_MS = 86_400_000;
export const SM2_INITIAL_EASE = 2.5;
export const SM2_MIN_EASE = 1.3;

/** Применяет одно повторение SM-2; возвращает новую запись, вход не мутирует. */
export function applySm2Review(record: SavedMistakeRecord, quality: Sm2Quality, now: number): SavedMistakeRecord {
  let repetitions: number;
  let intervalDays: number;
  if (quality < 3) {
    repetitions = 0;
    intervalDays = 1;
  } else {
    repetitions = record.repetitions + 1;
    if (repetitions === 1) intervalDays = 1;
    else if (repetitions === 2) intervalDays = 6;
    else intervalDays = Math.round(record.intervalDays * record.easeFactor);
  }
  const miss = 5 - quality;
  const easeFactor = Math.max(SM2_MIN_EASE, record.easeFactor + 0.1 - miss * (0.08 + miss * 0.02));
  return {
    ...record,
    repetitions,
    intervalDays,
    easeFactor,
    nextReviewAt: now + intervalDays * DAY_MS,
    lastReviewedAt: now,
  };
}
