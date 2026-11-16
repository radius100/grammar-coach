# Grammar Coach (Anti-Grammarly Extension)

## Core Product Invariant (CRITICAL)
- **NO AUTO-REWRITE:** The extension must NEVER provide a one-click "Fix all" button or replace user text automatically.
- Users must manually retype corrections to build muscle memory.
- Explanations must be concise (1-2 sentences) with a Socratic hint, not the ready answer.

## Tech Stack & Commands
- Chrome Extension Manifest V3 + TypeScript + Vite (`@crxjs/vite-plugin`).
- Build: `npm run build`
- Dev watch: `npm run dev`

## Architecture Rules
- `src/shared/types.ts`: Single source of truth for LLM JSON schemas and storage models.
- `src/content/`: Injected page scripts. Must use Shadow DOM for any UI overlays to isolate CSS from host pages.
- `src/background/`: Service worker for LLM API calls, rate limiting (debounce), and `chrome.alarms` spaced repetition checks.