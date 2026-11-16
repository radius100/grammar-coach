import { filterIssues } from './issue-filter';
import { SM2_INITIAL_EASE } from './sm2';
import type { GrammarIssue, SavedMistakeRecord, SupportedLanguage } from './types';

export function mistakeId(language: SupportedLanguage, ruleCode: string): string {
  return `${language}:${ruleCode}`;
}

/**
 * Возвращает новую карту записей с учётом issues проверки `text`.
 * Сначала прогоняет `filterIssues(issues, text)`; несколько issues с одним id — берётся первый.
 */
export function upsertMistakes(
  existing: Record<string, SavedMistakeRecord>,
  issues: GrammarIssue[],
  text: string,
  language: SupportedLanguage,
  now: number,
): Record<string, SavedMistakeRecord> {
  const result = { ...existing };
  const seen = new Set<string>();
  for (const issue of filterIssues(issues, text)) {
    const id = mistakeId(language, issue.ruleCode);
    if (seen.has(id)) continue;
    seen.add(id);

    const prev = existing[id];
    if (prev && prev.lastQuote === issue.quote) continue;

    result[id] = {
      id,
      ruleCode: issue.ruleCode,
      language,
      lastQuote: issue.quote,
      explanation: issue.explanation,
      lastHint: issue.hint,
      errorCount: (prev?.errorCount ?? 0) + 1,
      repetitions: 0,
      easeFactor: prev?.easeFactor ?? SM2_INITIAL_EASE,
      intervalDays: 0,
      nextReviewAt: now,
      lastReviewedAt: prev?.lastReviewedAt ?? null,
      createdAt: prev?.createdAt ?? now,
    };
  }
  return result;
}

/** Записи с `nextReviewAt <= now`, отсортированные по `nextReviewAt` по возрастанию. */
export function selectDueMistakes(records: Record<string, SavedMistakeRecord>, now: number): SavedMistakeRecord[] {
  return Object.values(records)
    .filter((r) => r.nextReviewAt <= now)
    .sort((a, b) => a.nextReviewAt - b.nextReviewAt);
}

export function countDue(records: Record<string, SavedMistakeRecord>, now: number): number {
  return selectDueMistakes(records, now).length;
}
