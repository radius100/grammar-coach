// Single writer of `mistakes` in chrome.storage.local (ADR-004). No state in module variables.

import { countDue, upsertMistakes } from '../shared/mistakes';
import { applySm2Review } from '../shared/sm2';
import type { GrammarIssue, SavedMistakeRecord, Sm2Quality, StorageSchema, SupportedLanguage } from '../shared/types';

export const DUE_ALARM = 'sm2-due-check';

async function readMistakes(): Promise<StorageSchema['mistakes']> {
  const { mistakes = {} } = (await chrome.storage.local.get('mistakes')) as Partial<StorageSchema>;
  return mistakes;
}

export async function refreshBadge(): Promise<void> {
  const n = countDue(await readMistakes(), Date.now());
  await chrome.action.setBadgeText({ text: n ? String(n) : '' });
}

export async function recordMistakes(
  issues: GrammarIssue[],
  text: string,
  language: SupportedLanguage,
): Promise<void> {
  const next = upsertMistakes(await readMistakes(), issues, text, language, Date.now());
  await chrome.storage.local.set({ mistakes: next } satisfies Partial<StorageSchema>);
  await refreshBadge();
}

export async function reviewMistake(id: string, quality: Sm2Quality): Promise<SavedMistakeRecord | null> {
  const mistakes = await readMistakes();
  const record = mistakes[id];
  if (!record) return null;
  const updated = applySm2Review(record, quality, Date.now());
  await chrome.storage.local.set({ mistakes: { ...mistakes, [id]: updated } } satisfies Partial<StorageSchema>);
  await refreshBadge();
  return updated;
}
