// Highlight layer. Stage 3: interface only (no DOM). Stage 4 renders it in a closed Shadow DOM.
// Never writes to the host field (see ADR-001).

import type { AnchoredIssue } from '../shared/types';

export function showHighlights(el: Element, anchored: AnchoredIssue[]): void {
  console.info('[GrammarCoach] highlights', el, anchored);
}

export function clearHighlights(): void {}
