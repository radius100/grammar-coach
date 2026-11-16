// Content script: watches text input and sends it to the background worker.
// MVP-0 never touches the page DOM and never modifies user text (see CLAUDE.md).

import { anchorIssues } from '../shared/anchor';
import { detectLanguage } from '../shared/language';
import { isSiteDisabled } from '../shared/site-filter';
import type { CheckTextMessage, GrammarCheckResponse, ResponseFor, StorageSchema } from '../shared/types';
import { clearHighlights, showHighlights } from './overlay';

const DEBOUNCE_MS = 1500;
const MIN_NON_SPACE_CHARS = 3;

const timers = new WeakMap<Element, number>();
const lastSentText = new WeakMap<Element, string>();
const lastResult = new WeakMap<Element, GrammarCheckResponse>();

let siteDisabled = false;

function applyDisabledSites(list: string[] | undefined): void {
  siteDisabled = isSiteDisabled(location.href, list);
  if (siteDisabled) clearHighlights();
}

function onStorageChanged(changes: Record<string, chrome.storage.StorageChange>, area: string): void {
  if (area === 'local' && 'disabledSites' in changes) {
    applyDisabledSites(changes.disabledSites.newValue as string[] | undefined);
  }
}

/** Re-anchors the last result on the field's CURRENT text (it may have changed during the request). */
function renderIssues(el: Element): void {
  const result = lastResult.get(el);
  if (!result) return;
  const anchored = anchorIssues(readText(el), result.issues);
  if (anchored.length) showHighlights(el, anchored);
  else clearHighlights();
}

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
  if (siteDisabled) return;
  if (lastSentText.get(el) === text) {
    renderIssues(el);
    return;
  }

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
    if (!response) return;
    if (response.ok) {
      lastResult.set(el, response.result);
      renderIssues(el);
    } else console.warn('[GrammarCoach] background error:', response.error);
  } catch (err) {
    // Typically "Extension context invalidated" after the extension was reloaded.
    if (!isExtensionAlive()) detach();
    else console.warn('[GrammarCoach] sendMessage failed:', err);
  }
}

function onInput(event: Event): void {
  if (siteDisabled) return;
  // composedPath()[0] reaches fields inside open shadow roots of the host page.
  const el = resolveEditable(event.composedPath()[0]);
  if (!el) return;

  // Text changed: hide highlights until debounce; lastResult is kept and re-anchored later.
  clearHighlights();

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
  try {
    if (typeof chrome !== 'undefined') chrome.storage?.onChanged.removeListener(onStorageChanged);
  } catch {
    // Runtime may already be unavailable after the extension was reloaded.
  }
  clearHighlights();
}

document.addEventListener('input', onInput, true);
chrome.storage.onChanged.addListener(onStorageChanged);
void chrome.storage.local
  .get('disabledSites')
  .then((d) => applyDisabledSites((d as Partial<StorageSchema>).disabledSites))
  .catch(() => {});
