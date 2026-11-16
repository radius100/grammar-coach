// Background service worker: receives text from content scripts, checks it with Claude.
// No state in module variables: the MV3 worker is killed when idle.

import { filterIssues } from '../shared/issue-filter';
import type {
  BackgroundMessage,
  ContentToBackgroundMessage,
  ResponseFor,
  ReviewMistakeMessage,
  SessionStorageSchema,
  StorageSchema,
} from '../shared/types';
import { checkGrammar, LlmError } from './llm';
import { DUE_ALARM, recordMistakes, refreshBadge, reviewMistake } from './mistake-store';

const MIN_INTERVAL_MS = 3000;

/** True, если для вкладки можно сделать запрос (и фиксирует время запроса). */
async function takeRateLimitSlot(tabKey: string): Promise<boolean> {
  const { lastRequestAt = {} } = (await chrome.storage.session.get('lastRequestAt')) as Partial<SessionStorageSchema>;
  const now = Date.now();
  if (now - (lastRequestAt[tabKey] ?? 0) < MIN_INTERVAL_MS) return false;
  await chrome.storage.session.set({ lastRequestAt: { ...lastRequestAt, [tabKey]: now } });
  return true;
}

async function handleCheckText(
  payload: Extract<ContentToBackgroundMessage, { type: 'CHECK_TEXT' }>['payload'],
  tabId: number | undefined,
): Promise<ResponseFor<Extract<ContentToBackgroundMessage, { type: 'CHECK_TEXT' }>>> {
  const stored = (await chrome.storage.local.get('apiKey')) as Partial<StorageSchema>;
  // Fallback for local testing: key from .env.local is baked into dist/ (never share that build).
  const apiKey = stored.apiKey ?? (import.meta.env.VITE_ANTHROPIC_API_KEY as string | undefined);
  if (!apiKey) return { ok: false, error: 'API-ключ не задан: откройте popup расширения' };

  if (!(await takeRateLimitSlot(String(tabId ?? 'unknown')))) {
    return { ok: false, error: 'Слишком частые запросы, попробуйте позже' };
  }

  try {
    const result = await checkGrammar(payload.text, payload.language, apiKey);
    const issues = filterIssues(result.issues, payload.text);
    console.log('[GrammarCoach] CHECK_TEXT', { language: result.language, raw: result.issues.length, kept: issues.length, issues });
    try {
      await recordMistakes(issues, payload.text, result.language);
    } catch (err) {
      console.warn('[GrammarCoach] saving mistakes failed:', err);
    }
    return { ok: true, result: { ...result, issues } };
  } catch (err) {
    const error = err instanceof LlmError ? err.message : String(err);
    console.warn('[GrammarCoach] check failed:', err);
    return { ok: false, error };
  }
}

async function handleReviewMistake(
  payload: ReviewMistakeMessage['payload'],
): Promise<ResponseFor<ReviewMistakeMessage>> {
  try {
    const result = await reviewMistake(payload.id, payload.quality);
    return result ? { ok: true, result } : { ok: false, error: 'Запись не найдена' };
  } catch (err) {
    console.warn('[GrammarCoach] review failed:', err);
    return { ok: false, error: String(err) };
  }
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.alarms.create(DUE_ALARM, { periodInMinutes: 60 });
  void refreshBadge();
});

chrome.runtime.onStartup.addListener(() => void refreshBadge());

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === DUE_ALARM) void refreshBadge();
});

chrome.runtime.onMessage.addListener((message: BackgroundMessage, sender, sendResponse) => {
  switch (message.type) {
    case 'CHECK_TEXT':
      void handleCheckText(message.payload, sender.tab?.id).then(sendResponse);
      return true; // async response
    case 'REVIEW_MISTAKE':
      void handleReviewMistake(message.payload).then(sendResponse);
      return true; // async response
    default: {
      // Compile-time exhaustiveness check: a new message type without a case fails here.
      const unknownMessage: never = message;
      sendResponse({ ok: false, error: `Unknown message: ${JSON.stringify(unknownMessage)}` });
      return false;
    }
  }
});
