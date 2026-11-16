import type { AnchoredIssue, GrammarIssue } from './types';

/**
 * Привязывает issues к тексту поля по точной цитате (`indexOf`), никогда по оффсетам от LLM.
 * Ненайденные и пустые quote отбрасываются; одинаковые quote занимают следующие вхождения;
 * пересекающиеся диапазоны отбрасываются. Результат отсортирован по `start`.
 */
export function anchorIssues(text: string, issues: GrammarIssue[]): AnchoredIssue[] {
  const nextFrom = new Map<string, number>();
  const anchored: AnchoredIssue[] = [];

  for (const issue of issues) {
    const { quote } = issue;
    if (!quote) continue;
    const start = text.indexOf(quote, nextFrom.get(quote) ?? 0);
    if (start === -1) continue;
    nextFrom.set(quote, start + quote.length);
    const end = start + quote.length;
    if (anchored.some((a) => start < a.end && a.start < end)) continue;
    anchored.push({ issue, start, end });
  }

  return anchored.sort((a, b) => a.start - b.start);
}

/** Issue, чей диапазон [start, end) содержит offset, или null. */
export function issueAtOffset(anchored: AnchoredIssue[], offset: number): AnchoredIssue | null {
  return anchored.find((a) => offset >= a.start && offset < a.end) ?? null;
}
