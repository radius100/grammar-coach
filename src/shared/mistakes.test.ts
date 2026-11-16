import { describe, expect, it } from 'vitest';
import { countDue, mistakeId, selectDueMistakes, upsertMistakes } from './mistakes';
import { DAY_MS } from './sm2';
import type { GrammarIssue, SavedMistakeRecord } from './types';

const now = 1_000_000;
const text = 'I has a apple.';

const makeIssue = (overrides: Partial<GrammarIssue> = {}): GrammarIssue => ({
  quote: 'a apple',
  ruleCode: 'EN_ARTICLE',
  explanation: 'Article depends on the next sound.',
  hint: 'Which sound does the next word start with?',
  ...overrides,
});

const makeRecord = (overrides: Partial<SavedMistakeRecord> = {}): SavedMistakeRecord => ({
  id: 'en:EN_ARTICLE',
  ruleCode: 'EN_ARTICLE',
  language: 'en',
  lastQuote: 'a apple',
  explanation: 'Old explanation.',
  lastHint: 'Old hint.',
  errorCount: 1,
  repetitions: 0,
  easeFactor: 2.5,
  intervalDays: 0,
  nextReviewAt: now,
  lastReviewedAt: null,
  createdAt: 100,
  ...overrides,
});

describe('mistakeId', () => {
  it('mistakeId joins language and rule', () => {
    expect(mistakeId('en', 'EN_ARTICLE')).toBe('en:EN_ARTICLE');
  });
});

describe('upsertMistakes', () => {
  it('creates a new record', () => {
    const issue = makeIssue();
    const result = upsertMistakes({}, [issue], text, 'en', now);
    expect(result['en:EN_ARTICLE']).toEqual({
      id: 'en:EN_ARTICLE',
      ruleCode: 'EN_ARTICLE',
      language: 'en',
      lastQuote: issue.quote,
      lastHint: issue.hint,
      explanation: issue.explanation,
      errorCount: 1,
      repetitions: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      nextReviewAt: now,
      lastReviewedAt: null,
      createdAt: now,
    });
  });

  it('quote anchoring: skips issue whose quote is not in text (indexOf)', () => {
    expect(upsertMistakes({}, [makeIssue({ quote: 'an apple' })], text, 'en', now)).toEqual({});
  });

  it('hint must not contain the corrected form: skips leaking issue', () => {
    expect(upsertMistakes({}, [makeIssue({ hint: 'Try "an apple".' })], text, 'en', now)).toEqual({});
  });

  it('same quote again does not inflate count', () => {
    const existing = makeRecord({ repetitions: 2, intervalDays: 6, nextReviewAt: now + 5 * DAY_MS });
    const result = upsertMistakes({ [existing.id]: existing }, [makeIssue()], text, 'en', now);
    const record = result[existing.id];
    expect(record.errorCount).toBe(existing.errorCount);
    expect(record.repetitions).toBe(2);
    expect(record.intervalDays).toBe(6);
    expect(record.nextReviewAt).toBe(now + 5 * DAY_MS);
  });

  it('new quote of same rule counts and resets schedule', () => {
    const existing = makeRecord({
      lastQuote: 'a cat',
      errorCount: 2,
      easeFactor: 2.0,
      repetitions: 3,
      intervalDays: 15,
      nextReviewAt: now + 15 * DAY_MS,
    });
    const record = upsertMistakes({ [existing.id]: existing }, [makeIssue()], text, 'en', now)[existing.id];
    expect(record.errorCount).toBe(3);
    expect(record.lastQuote).toBe('a apple');
    expect(record.repetitions).toBe(0);
    expect(record.intervalDays).toBe(0);
    expect(record.nextReviewAt).toBe(now);
    expect(record.easeFactor).toBe(2.0);
    expect(record.createdAt).toBe(existing.createdAt);
  });

  it('duplicate rule in one check counted once', () => {
    const issues = [makeIssue(), makeIssue({ quote: 'has' })];
    expect(upsertMistakes({}, issues, text, 'en', now)['en:EN_ARTICLE'].errorCount).toBe(1);
  });

  it('does not mutate existing map', () => {
    const existing = { 'en:EN_ARTICLE': makeRecord({ lastQuote: 'a cat' }) };
    const copy = structuredClone(existing);
    upsertMistakes(existing, [makeIssue()], text, 'en', now);
    expect(existing).toEqual(copy);
  });
});

describe('due selection', () => {
  const records = Object.fromEntries(
    [
      ['a', now + 1],
      ['b', now - 5],
      ['c', now - 10],
      ['d', now],
    ].map(([id, nextReviewAt]) => [id, makeRecord({ id: String(id), nextReviewAt: Number(nextReviewAt) })]),
  );

  it('selectDueMistakes filters and sorts', () => {
    expect(selectDueMistakes(records, now).map((r) => r.id)).toEqual(['c', 'b', 'd']);
  });

  it('countDue', () => {
    expect(countDue(records, now)).toBe(3);
  });
});
