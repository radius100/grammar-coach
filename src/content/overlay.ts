// Highlight layer: wavy underlines over the field + popover with explanation and hint.
// Everything lives in ONE host element with a closed shadow root (ADR-001).
// The host field is only READ (getComputedStyle, getBoundingClientRect, Range rects); never written.
// No "Fix / Apply / Accept" controls: the user retypes corrections manually.

import type { AnchoredIssue } from '../shared/types';

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

interface Painted {
  anchored: AnchoredIssue;
  boxes: Box[];
}

const STYLE = `
:host {
  all: initial !important;
  position: fixed !important;
  inset: 0 !important;
  pointer-events: none !important;
  z-index: 2147483647 !important;
}
.mark {
  position: fixed;
  border-bottom: 2px wavy #e5484d;
  box-sizing: border-box;
  pointer-events: none;
}
.mirror {
  position: fixed;
  visibility: hidden;
  overflow: hidden;
  pointer-events: none;
}
.popover {
  position: fixed;
  max-width: 320px;
  padding: 10px 28px 10px 12px;
  border-radius: 8px;
  background: #fff;
  color: #1c2024;
  border: 1px solid #d9d9e0;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  pointer-events: auto;
}
.popover[hidden] { display: none; }
.explanation { margin: 0 0 6px; }
.hint { margin: 0; font-style: italic; color: #60646c; }
.hint::before { content: '💡 '; font-style: normal; }
.close {
  position: absolute;
  top: 4px;
  right: 6px;
  border: 0;
  background: none;
  color: inherit;
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  opacity: 0.6;
}
.close:hover { opacity: 1; }
@media (prefers-color-scheme: dark) {
  .popover { background: #1f2125; color: #edeef0; border-color: #3a3f42; }
  .hint { color: #b0b4ba; }
  .mark { border-bottom-color: #ff6369; }
}
`;

/** Computed-style properties that affect text layout; copied onto the mirror. */
const MIRROR_PROPS = [
  'boxSizing', 'width', 'height',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderStyle',
  'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'fontVariant', 'fontStretch',
  'letterSpacing', 'wordSpacing', 'lineHeight', 'textTransform', 'textIndent', 'textAlign',
  'tabSize', 'direction',
] as const;

let ui: { root: ShadowRoot; layer: HTMLElement; popover: HTMLElement } | null = null;
let field: Element | null = null;
let current: AnchoredIssue[] = [];
let painted: Painted[] = [];
let shownIssue: AnchoredIssue | null = null;
let rafId = 0;

function ensureUi(): NonNullable<typeof ui> {
  if (ui?.root.host.isConnected) return ui;
  const host = document.createElement('grammar-coach-root');
  const root = host.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = STYLE;
  const layer = document.createElement('div');
  const popover = document.createElement('div');
  popover.className = 'popover';
  popover.hidden = true;
  root.append(style, layer, popover);
  document.documentElement.append(host);
  ui = { root, layer, popover };
  return ui;
}

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

function toBoxes(rects: Iterable<DOMRect>, clip: DOMRect): Box[] {
  const boxes: Box[] = [];
  for (const r of rects) {
    const left = Math.max(r.left, clip.left);
    const right = Math.min(r.right, clip.right);
    const top = Math.max(r.top, clip.top);
    const bottom = Math.min(r.bottom, clip.bottom);
    if (right - left > 0 && bottom - top > 0) boxes.push({ left, top, width: right - left, height: bottom - top });
  }
  return boxes;
}

/** textarea / input: measure in a hidden mirror inside OUR shadow root that copies the field's layout. */
function measureFormField(el: HTMLTextAreaElement | HTMLInputElement, items: AnchoredIssue[]): Painted[] {
  const { root } = ensureUi();
  const cs = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  const mirror = document.createElement('div');
  mirror.className = 'mirror';
  for (const prop of MIRROR_PROPS) mirror.style[prop] = cs[prop];
  mirror.style.left = `${rect.left}px`;
  mirror.style.top = `${rect.top}px`;
  const isTextarea = el instanceof HTMLTextAreaElement;
  mirror.style.whiteSpace = isTextarea ? 'pre-wrap' : 'pre';
  mirror.style.overflowWrap = isTextarea ? 'break-word' : 'normal';
  if (isTextarea && el.scrollHeight > el.clientHeight) mirror.style.overflowY = 'scroll';
  // Writes go to our own shadow node, never to the host field.
  const text = document.createTextNode(el.value + '​');
  mirror.append(text);
  root.append(mirror);
  mirror.scrollTop = el.scrollTop;
  mirror.scrollLeft = el.scrollLeft;

  const clip = contentClip(el, rect);
  const range = document.createRange();
  const result = items.map((anchored) => {
    range.setStart(text, anchored.start);
    range.setEnd(text, anchored.end);
    return { anchored, boxes: toBoxes(range.getClientRects(), clip) };
  });
  mirror.remove();
  return result;
}

/** Visible content area of a field (inside borders), in viewport coordinates. */
function contentClip(el: Element, rect: DOMRect): DOMRect {
  const cs = getComputedStyle(el);
  const bl = parseFloat(cs.borderLeftWidth) || 0;
  const bt = parseFloat(cs.borderTopWidth) || 0;
  return new DOMRect(rect.left + bl, rect.top + bt, el.clientWidth || rect.width, el.clientHeight || rect.height);
}

/**
 * contenteditable: map each quote to text nodes (read-only Range, no DOM mutation).
 * Offsets from innerText do not match text-node offsets (block line breaks), so we find the
 * same occurrence number of the quote in the concatenated text-node string instead.
 */
function measureEditable(el: HTMLElement, items: AnchoredIssue[]): Painted[] {
  const nodes: { node: Text; start: number }[] = [];
  let concat = '';
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push({ node: n as Text, start: concat.length });
    concat += (n as Text).data;
  }
  const visibleText = el.innerText;
  const clip = contentClip(el, el.getBoundingClientRect());
  const range = document.createRange();

  const locate = (offset: number, preferNext: boolean): { node: Text; offset: number } | null => {
    for (let i = 0; i < nodes.length; i++) {
      const { node, start } = nodes[i];
      const end = start + node.data.length;
      if (offset < end || (offset === end && !preferNext)) return { node, offset: offset - start };
    }
    const last = nodes.at(-1);
    return last ? { node: last.node, offset: last.node.data.length } : null;
  };

  return items.flatMap((anchored) => {
    const { quote } = anchored.issue;
    const occurrence = countOccurrences(visibleText, quote, anchored.start);
    let pos = -1;
    for (let k = 0; k <= occurrence; k++) {
      pos = concat.indexOf(quote, pos + 1);
      if (pos === -1) return [];
    }
    const from = locate(pos, true);
    const to = locate(pos + quote.length, false);
    if (!from || !to) return [];
    range.setStart(from.node, from.offset);
    range.setEnd(to.node, to.offset);
    return [{ anchored, boxes: toBoxes(range.getClientRects(), clip) }];
  });
}

function countOccurrences(text: string, quote: string, before: number): number {
  let count = 0;
  for (let i = text.indexOf(quote); i !== -1 && i < before; i = text.indexOf(quote, i + 1)) count++;
  return count;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function render(): void {
  rafId = 0;
  if (!field || !field.isConnected) {
    clearHighlights();
    return;
  }
  const { layer } = ensureUi();
  painted =
    field instanceof HTMLTextAreaElement || field instanceof HTMLInputElement
      ? measureFormField(field, current)
      : field instanceof HTMLElement
        ? measureEditable(field, current)
        : [];

  const marks: HTMLElement[] = [];
  for (const { boxes } of painted) {
    for (const b of boxes) {
      const mark = document.createElement('div');
      mark.className = 'mark';
      mark.style.cssText = `left:${b.left}px;top:${b.top}px;width:${b.width}px;height:${b.height}px`;
      marks.push(mark);
    }
  }
  layer.replaceChildren(...marks);
  if (shownIssue && !painted.some((p) => p.anchored === shownIssue && p.boxes.length)) hidePopover();
}

function scheduleRender(): void {
  if (!rafId) rafId = requestAnimationFrame(render);
}

function showPopover(anchored: AnchoredIssue, box: Box): void {
  const { popover } = ensureUi();
  shownIssue = anchored;
  const explanation = document.createElement('p');
  explanation.className = 'explanation';
  explanation.textContent = anchored.issue.explanation;
  const hint = document.createElement('p');
  hint.className = 'hint';
  hint.textContent = anchored.issue.hint;
  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'close';
  close.setAttribute('aria-label', 'Закрыть');
  close.textContent = '×';
  close.addEventListener('click', hidePopover);
  popover.replaceChildren(explanation, hint, close);
  popover.hidden = false;

  const { width, height } = popover.getBoundingClientRect();
  const left = Math.max(8, Math.min(box.left, innerWidth - width - 8));
  const below = box.top + box.height + 6;
  const top = below + height > innerHeight - 8 ? Math.max(8, box.top - height - 6) : below;
  popover.style.left = `${left}px`;
  popover.style.top = `${top}px`;
}

function hidePopover(): void {
  shownIssue = null;
  if (ui) ui.popover.hidden = true;
}

function onPointerMove(event: MouseEvent): void {
  if (!ui) return;
  const { clientX: x, clientY: y } = event;
  const pr = ui.popover.hidden ? null : ui.popover.getBoundingClientRect();
  if (pr && x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) return;

  for (const p of painted) {
    const box = p.boxes.find((b) => x >= b.left && x <= b.left + b.width && y >= b.top - 2 && y <= b.top + b.height + 2);
    if (box) {
      if (shownIssue !== p.anchored) showPopover(p.anchored, box);
      return;
    }
  }
  hidePopover();
}

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === 'Escape') hidePopover();
}

function listen(on: boolean): void {
  const method = on ? 'addEventListener' : 'removeEventListener';
  document[method]('scroll', scheduleRender, { capture: true, passive: true } as AddEventListenerOptions);
  window[method]('resize', scheduleRender, { passive: true } as AddEventListenerOptions);
  document[method]('mousemove', onPointerMove as EventListener, { passive: true } as AddEventListenerOptions);
  document[method]('keydown', onKeyDown as EventListener, true);
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function showHighlights(el: Element, anchored: AnchoredIssue[]): void {
  if (!field) listen(true);
  field = el;
  current = anchored;
  hidePopover();
  scheduleRender();
}

export function clearHighlights(): void {
  if (field) listen(false);
  field = null;
  current = [];
  painted = [];
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  hidePopover();
  ui?.layer.replaceChildren();
}
