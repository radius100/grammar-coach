import { describe, expect, it } from 'vitest';
import { applySm2Review, DAY_MS } from './sm2';
import type { SavedMistakeRecord } from './types';

const now = 1_000_000;

const makeRecord = (overrides: Partial<SavedMistakeRecord> = {}): SavedMistakeRecord => ({
  id: 'en:EN_ARTICLE',
  ruleCode: 'EN_ARTICLE',
  language: 'en',
  lastQuote: 'a apple',
  explanation: 'Explanation.',
  lastHint: 'Which sound does the next word start with?',
  errorCount: 2,
  repetitions: 0,
  easeFactor: 2.5,
  intervalDays: 0,
  nextReviewAt: 0,
  lastReviewedAt: null,
  createdAt: 500,
  ...overrides,
});

describe('applySm2Review', () => {
  it('first successful review gives 1 day', () => {
    const next = applySm2Review(makeRecord(), 5, now);
    expect(next.repetitions).toBe(1);
    expect(next.intervalDays).toBe(1);
    expect(next.nextReviewAt).toBe(now + DAY_MS);
    expect(next.lastReviewedAt).toBe(now);
  });

  it('second successful review gives 6 days', () => {
    const next = applySm2Review(makeRecord({ repetitions: 1, intervalDays: 1 }), 4, now);
    expect(next.repetitions).toBe(2);
    expect(next.intervalDays).toBe(6);
  });

  it('third review multiplies by EF', () => {
    const next = applySm2Review(makeRecord({ repetitions: 2, intervalDays: 6, easeFactor: 2.5 }), 4, now);
    expect(next.intervalDays).toBe(15);
    expect(next.easeFactor).toBe(2.5);
  });

  it('failure resets repetitions', () => {
    const next = applySm2Review(makeRecord({ repetitions: 3, intervalDays: 15 }), 1, now);
    expect(next.repetitions).toBe(0);
    expect(next.intervalDays).toBe(1);
  });

  it('ease factor updates', () => {
    expect(applySm2Review(makeRecord({ easeFactor: 2.5 }), 5, now).easeFactor).toBeCloseTo(2.6);
    expect(applySm2Review(makeRecord({ easeFactor: 2.5 }), 3, now).easeFactor).toBeCloseTo(2.36);
  });

  it('ease factor never below 1.3', () => {
    expect(applySm2Review(makeRecord({ easeFactor: 1.3 }), 0, now).easeFactor).toBe(1.3);
  });

  it('does not mutate input', () => {
    const record = makeRecord({ repetitions: 2, intervalDays: 6 });
    const copy = { ...record };
    applySm2Review(record, 4, now);
    expect(record).toEqual(copy);
  });

  it('keeps non-SM2 fields', () => {
    const record = makeRecord();
    const next = applySm2Review(record, 4, now);
    expect(next.errorCount).toBe(record.errorCount);
    expect(next.lastQuote).toBe(record.lastQuote);
    expect(next.lastHint).toBe(record.lastHint);
    expect(next.createdAt).toBe(record.createdAt);
  });
});
