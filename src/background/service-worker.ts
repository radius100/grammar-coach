// Background service worker. MVP-0: receives text from content scripts and logs it.

import type { ContentToBackgroundMessage, MessageResult } from '../shared/types';

chrome.runtime.onMessage.addListener(
  (message: ContentToBackgroundMessage, sender, sendResponse: (response: MessageResult) => void) => {
    switch (message.type) {
      case 'CHECK_TEXT': {
        const { text, language, url } = message.payload;
        console.log('[GrammarCoach] CHECK_TEXT', {
          language,
          length: text.length,
          text,
          url,
          tabId: sender.tab?.id,
        });
        sendResponse({ ok: true });
        return false;
      }
      default: {
        // Compile-time exhaustiveness check: a new message type without a case fails here.
        const unknownType: never = message.type;
        sendResponse({ ok: false, error: `Unknown message type: ${String(unknownType)}` });
        return false;
      }
    }
  },
);
