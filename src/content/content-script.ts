// Content script: watches text input and sends it to the background worker.
// MVP-0 never touches the page DOM and never modifies user text (see CLAUDE.md).

import { detectLanguage } from '../shared/language';
import type { CheckTextMessage, ResponseFor } from '../shared/types';

const DEBOUNCE_MS = 1500;
const MIN_NON_SPACE_CHARS = 3;

const timers = new WeakMap<Element, number>();
const lastSentText = new WeakMap<Element, string>();

/** Field we track: textarea, input[type=text] or the root of a contenteditable. */
function resolveEditable(target: EventTarget | undefined): Element | null {
  if (target instanceof HTMLTextAreaElement) return target;
  if (target instanceof HTMLInputElement) return target.type === 'text' ? target : null;
  if (target instanceof HTMLElement && target.isContentEditable) {
    let root: HTMLElement = target;
    while (root.parentElement?.isContentEditable) root = root.parentElement;
    return root;
  }
  return null;
}

function readText(el: Element): string {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement) return el.value;
  return el instanceof HTMLElement ? el.innerText : '';
}

function isExtensionAlive(): boolean {
  return typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id);
}

async function sendText(el: Element): Promise<void> {
  const text = readText(el);
  if (text.replace(/\s/g, '').length < MIN_NON_SPACE_CHARS) return;
  if (lastSentText.get(el) === text) return;

  if (!isExtensionAlive()) {
    detach();
    return;
  }

  const message: CheckTextMessage = {
    type: 'CHECK_TEXT',
    payload: { text, language: detectLanguage(text), url: location.href },
  };

  try {
    const response = await chrome.runtime.sendMessage<CheckTextMessage, ResponseFor<CheckTextMessage>>(message);
    lastSentText.set(el, text);
    if (response && !response.ok) console.warn('[GrammarCoach] background error:', response.error);
  } catch (err) {
    // Typically "Extension context invalidated" after the extension was reloaded.
    if (!isExtensionAlive()) detach();
    else console.warn('[GrammarCoach] sendMessage failed:', err);
  }
}

function onInput(event: Event): void {
  // composedPath()[0] reaches fields inside open shadow roots of the host page.
  const el = resolveEditable(event.composedPath()[0]);
  if (!el) return;

  const pending = timers.get(el);
  if (pending !== undefined) clearTimeout(pending);
  timers.set(
    el,
    window.setTimeout(() => {
      timers.delete(el);
      void sendText(el);
    }, DEBOUNCE_MS),
  );
}

function detach(): void {
  document.removeEventListener('input', onInput, true);
}

document.addEventListener('input', onInput, true);
