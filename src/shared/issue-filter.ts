import type { GrammarIssue } from './types';

const QUOTED = /[«"“„']([^«»"“”„']{3,})[»"”']/g;

/**
 * True, если подсказка, похоже, содержит готовый ответ: в кавычках
 * приведён фрагмент, которого нет в исходном тексте пользователя.
 * Консервативная эвристика: лучше отбросить issue, чем выдать ответ.
 */
export function hintLeaksAnswer(issue: GrammarIssue, text: string): boolean {
  for (const match of issue.hint.matchAll(QUOTED)) {
    const fragment = match[1].trim();
    if (fragment && !text.includes(fragment)) return true;
  }
  return false;
}

/** Оставляет только issues, чья цитата есть в тексте и чья подсказка не раскрывает ответ. */
export function filterIssues(issues: GrammarIssue[], text: string): GrammarIssue[] {
  return issues.filter(
    (issue) => issue.quote.length > 0 && text.indexOf(issue.quote) !== -1 && !hintLeaksAnswer(issue, text),
  );
}
