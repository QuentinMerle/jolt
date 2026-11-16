# Contributing to Jolt ⚡

Thank you for your interest! **Jolt** is **Open Source (MIT License)** and welcomes pull requests, issues, and feedback.

## Core Design Principles

1. **Zero Runtime Dependencies:** Jolt ships no third-party npm dependencies and relies strictly on native Node 22+ and browser APIs (`Web Components`, `Shadow DOM`, `ElementInternals`).
2. **0 Bytes in Production:** The Vite plugin enforces `apply: 'serve'` and client adapters cleanly no-op whenever `window.__JOLT__` is absent.
3. **Safety & Token Budget:** Keep every digest compact and route payloads through `sanitizePayload()` (`src/shared/sanitizer.ts`).

## Local Workflow

```bash
# Build src/ -> dist/
npm run build

# Run unit and integration tests
npm test

# Start the interactive Playground (http://127.0.0.1:5173)
npm run dev:playground
```

## Welcome Contribution Areas

- **Framework & Store Adapters:** Svelte 5 stores/runes, Angular signals, Jotai, MobX, React Three Fiber (`<JoltR3F />`).
- **MCP Apps / MCP UI:** Interactive `ui://jolt/*` views embedded inside IDE agent chats (causal timeline, WebGL2 inspector, CSS preview diffs).
- **Test Repro Exporters:** Generate Playwright / Vitest / Cypress scripts directly from `flightRecorder`.
- **Cross-Browser Verification:** Chrome, Safari (WebGL2/ANGLE), Firefox.
