# Grammar Coach (Anti-Grammarly Extension)

Chrome extension (Manifest V3) that trains RU/EN writing. It points out mistakes
and never fixes them for the user.

## Product Invariants (CRITICAL, never violate)

- **NO AUTO-REWRITE.** The extension NEVER modifies user text: no `value =`,
  no `execCommand('insertText')`, no `textContent =` on host editable fields,
  no "Fix all" / "Apply" / "Accept suggestion" buttons.
- The user retypes corrections manually to build muscle memory.
- Allowed feedback per issue, nothing more:
  1. highlight of the exact `quote` from the user's text;
  2. rule explanation: 1-2 sentences;
  3. Socratic `hint` that leads to the answer and does NOT contain the corrected text.
- LLM prompts must ask for hints without the answer. Reject or drop issues whose
  hint contains the corrected form.

## UI Isolation

- Every overlay injected into a web page lives inside a Shadow DOM
  (`attachShadow({ mode: 'closed' })`) on a single host element.
- No global CSS, no styles on host page elements, no class names added to host nodes.
- Highlights are drawn as overlays positioned over the field, not by editing its DOM.

## Contract First

- Before changing architecture or contracts, read `docs/adr/` (ADR-001 UI isolation,
  ADR-002 contract & quote anchoring, ADR-003 MV3 messaging & storage,
  ADR-004 mistake storage & SM-2 review).

- `src/shared/types.ts` is the single source of truth for: the LLM response schema
  (`GrammarCheckResponse` / `GrammarIssue`), content <-> background messages,
  and storage models (`SavedMistakeRecord`, `StorageSchema`).
- Change the contract there first, then the code. Do not redeclare these shapes elsewhere.
- Issues are anchored by exact `quote` (found via `indexOf` in the current text),
  never by LLM-provided character offsets.
- `types.ts` holds types only; runtime helpers go in other `src/shared/*` files.

## Commands

- `npm run build` - type check (`tsc -b`) + production build into `dist/`.
  Run it after every change; it is the verification step.
- `npm run dev` - crxjs dev build with HMR (load `dist/` unpacked in Chrome).
- `npm run lint` - ESLint.

## Workflow

- New features: `/plan-feature <feature description>` -> writes `.claude/current-plan.md` (gitignored).
- Execute in a fresh session: `/create-planned-feature`, one stage = one commit
  (ADR -> contracts -> tests -> logic -> UI). Do not implement planned features ad hoc.

## Architecture

- `manifest.json` (project root) - consumed by `@crxjs/vite-plugin` in `vite.config.ts`.
  Do NOT put it in `public/` (it would be copied verbatim and skip crxjs processing).
- `src/content/` - content script: watches `<textarea>`, `<input type="text">`,
  contenteditable; debounces input (1500 ms per element); sends messages to background.
- `src/background/` - service worker: LLM API calls, rate limiting,
  `chrome.alarms` for SM-2 spaced repetition. API keys live only here.
- `src/shared/` - contracts (`types.ts`) and pure helpers (`language.ts`).
- Popup: `index.html` -> `src/main.tsx` (React).

## Gotchas

- Manifest entry files MUST have unique basenames (`service-worker.ts`,
  `content-script.ts`, never two `index.ts`): crxjs beta + Vite 8 resolves the
  service-worker loader by chunk name and may import the content script instead
  ("document is not defined" in the worker).

- Never read password/email fields; only `type="text"` inputs.
- After reloading the extension, old content scripts lose the runtime
  ("Extension context invalidated"): check `chrome.runtime?.id` and detach listeners.
- The MV3 service worker is killed when idle: keep no state in module variables,
  persist to `chrome.storage`.
