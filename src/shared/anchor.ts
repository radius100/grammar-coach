import type { AnchoredIssue, GrammarIssue } from './types';

/**
 * Привязывает issues к тексту поля по точной цитате (`indexOf`), никогда по оффсетам от LLM.
 * Ненайденные и пустые quote отбрасываются; одинаковые quote занимают следующие вхождения;
 * пересекающиеся диапазоны отбрасываются. Результат отсортирован по `start`.
 */
export function anchorIssues(text: string, issues: GrammarIssue[]): AnchoredIssue[] {
  void text;
  void issues;
  throw new Error('not implemented');
}

/** Issue, чей диапазон [start, end) содержит offset, или null. */
export function issueAtOffset(anchored: AnchoredIssue[], offset: number): AnchoredIssue | null {
  void anchored;
  void offset;
  throw new Error('not implemented');
}
