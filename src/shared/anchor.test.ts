import { describe, expect, it } from 'vitest';
import { anchorIssues, issueAtOffset } from './anchor';
import type { GrammarIssue } from './types';

const issue = (quote: string, ruleCode = 'EN_TEST'): GrammarIssue => ({
  quote,
  ruleCode,
  explanation: 'Explanation.',
  hint: 'Think about it.',
});

describe('anchorIssues', () => {
  it('anchors by quote via indexOf', () => {
    const text = 'I has a apple.';
    const [a] = anchorIssues(text, [issue('has')]);
    expect(a.start).toBe(text.indexOf('has'));
    expect(a.end).toBe(a.start + 'has'.length);
    expect(text.slice(a.start, a.end)).toBe('has');
  });

  it('drops issues whose quote is not in the text', () => {
    expect(anchorIssues('Hello world', [issue('missing')])).toEqual([]);
  });

  it('drops empty quotes', () => {
    expect(anchorIssues('Hello world', [issue('')])).toEqual([]);
  });

  it('re-anchors on changed text: shifted quote moves, removed quote disappears', () => {
    const issues = [issue('has'), issue('a apple')];
    const changed = 'Yesterday I has an apple.';
    const anchored = anchorIssues(changed, issues);
    expect(anchored).toHaveLength(1);
    expect(anchored[0].start).toBe(changed.indexOf('has'));
  });

  it('assigns repeated identical quotes to successive occurrences', () => {
    const text = 'teh cat and teh dog';
    const anchored = anchorIssues(text, [issue('teh'), issue('teh')]);
    expect(anchored.map((a) => a.start)).toEqual([0, text.indexOf('teh', 1)]);
  });

  it('drops a duplicate quote with no further occurrence', () => {
    expect(anchorIssues('teh cat', [issue('teh'), issue('teh')])).toHaveLength(1);
  });

  it('drops overlapping ranges, keeping the first', () => {
    const text = 'I has a apple';
    const anchored = anchorIssues(text, [issue('has a'), issue('a apple')]);
    expect(anchored).toHaveLength(1);
    expect(anchored[0].issue.quote).toBe('has a');
  });

  it('sorts results by start', () => {
    const text = 'one two three';
    const anchored = anchorIssues(text, [issue('three'), issue('one')]);
    expect(anchored.map((a) => a.issue.quote)).toEqual(['one', 'three']);
  });

  it('handles Cyrillic and emoji in UTF-16 units', () => {
    const text = '😀 Привет, как дела мой друг';
    const [a] = anchorIssues(text, [issue('дела мой', 'RU_TEST')]);
    expect(text.slice(a.start, a.end)).toBe('дела мой');
    expect(a.start).toBe(text.indexOf('дела мой'));
  });
});

describe('issueAtOffset', () => {
  // 'has' occupies [2, 5) in 'I has a apple'; built by hand so these tests don't depend on anchorIssues.
  const anchored = [{ issue: issue('has'), start: 2, end: 5 }];

  it('finds issue at start (inclusive)', () => {
    expect(issueAtOffset(anchored, 2)?.issue.quote).toBe('has');
  });

  it('finds issue inside range', () => {
    expect(issueAtOffset(anchored, 3)?.issue.quote).toBe('has');
  });

  it('returns null at end (exclusive) and outside', () => {
    expect(issueAtOffset(anchored, 5)).toBeNull();
    expect(issueAtOffset(anchored, 0)).toBeNull();
  });
});
