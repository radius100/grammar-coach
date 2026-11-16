import { describe, expect, it } from 'vitest';
import { filterIssues, hintLeaksAnswer } from './issue-filter';
import type { GrammarIssue } from './types';

const text = 'I has a apple.';
const make = (quote: string, hint: string): GrammarIssue => ({
  quote,
  ruleCode: 'EN_TEST',
  explanation: 'Explanation.',
  hint,
});

describe('hint must not contain the corrected form', () => {
  it('flags a hint quoting a corrected fragment absent from the text', () => {
    expect(hintLeaksAnswer(make('has', 'Try "I have" instead.'), text)).toBe(true);
    expect(hintLeaksAnswer(make('a apple', 'Подумайте: «an apple»?'), text)).toBe(true);
  });

  it('allows a hint that quotes the user own text', () => {
    expect(hintLeaksAnswer(make('has', 'Who is the subject of "I has"?'), text)).toBe(false);
  });

  it('allows a hint without quotes', () => {
    expect(hintLeaksAnswer(make('has', 'Which verb form goes with "I"?'), text)).toBe(false);
  });
});

describe('filterIssues', () => {
  it('drops leaking hints, missing quotes and empty quotes; keeps valid ones', () => {
    const ok = make('has', 'Which verb form agrees with the first person?');
    const result = filterIssues(
      [ok, make('has', 'Use "have".'), make('goes', 'Hmm.'), make('', 'Hmm.')],
      text,
    );
    expect(result).toEqual([ok]);
  });
});
