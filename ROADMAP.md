# Jolt ⚡ Roadmap (`vite-plugin-jolt`)

This document separates the **V1 Open Source** scope (current focus) from post-V1 evolutions (**MCP UI / MCP Apps**, additional ecosystem adapters).

---

## V1 — Open Source Core (Ready / Finalizing)

### Shipped & Tested
- **Local-First Bridge (`.jolt/` + 120 ms SSE):** Zero runtime dependencies, `apply: 'serve'` (0 bytes in production), automatic secret redaction (`src/shared/sanitizer.ts`).
- **Source-Locator & Framework Introspection:** `data-jolt-loc="file:line:col"` annotation (`.html`, `.jsx`, `.tsx`, `.vue`, `.svelte`), React Fiber & Vue 3 `componentChain`, compact A11y tree, and `viewport` metrics (`horizontalOverflow`).
- **HUD `<jolt-hud>` & Browser ↔ IDE Prompting:** Shadow DOM Web Component, **direct front-end instruction input** (`Alt + Click` targeted or global), in-memory CSS preview Spotlight, `LIVE` state (`status: "listening"`), and **Stop** button (`[STOP_LIVE]`) to hand control back to IDE chat.
- **Plug & Play Adapters (`vite-plugin-jolt/adapters`):** `joltZustand`, `joltPinia`, `joltPiniaStore`, `joltRedux`, `joltThree` (auto 2D `screenRect` projection + `joltThreeScene` store).
- **CLI & Standard npm Build:** `npx jolt-mcp init --write` (`AGENTS.md`, `.mcp.json`, `.gitignore`), `npx jolt-mcp listen`, `npm run build` (`src/` → `dist/` via Node 22 `stripTypeScriptTypes`), 5 MCP tools (`jolt_get_digest`, `jolt_inspect_element`, `jolt_mutate_runtime`, `jolt_mock_network`, `jolt_spotlight`), and Vite `configResolved` `rootDir` sync.
- **Landing Page & Documentation:** Interactive Playground with static-hosting fallback, [README.md](README.md), [AGENTS.md](AGENTS.md), [CONTRIBUTING.md](CONTRIBUTING.md), [LICENSE](LICENSE) (MIT).

### Remaining V1 Release Steps
1. **Field Validation:** Smoke-test `vite-plugin-jolt` + `vite-plugin-jolt/adapters` in a separate Vite + React (+ Zustand + TSX) and/or Vite + Vue (+ Pinia) starter app (verifying `enforce: 'pre'`, `data-jolt-loc`, and `componentChain` alongside official framework plugins).
2. **Public Release:** Push initial commit to [`QuentinMerle/jolt`](https://github.com/QuentinMerle/jolt), deploy static Landing Page, and publish `vite-plugin-jolt@0.1.0` to npm.

---

## Post-V1 — V1.1 / V1.2 (Core Hardening, Agent Experience & Ecosystem)

- **AST-Powered Source-Locator (Replacing Regex):** Upgrade `injectSourceLocations` for JSX/TSX, Vue SFCs, and Svelte templates using a lightweight parser/AST pass, extending support to SVG elements and custom UI component tags cleanly.
- **Beyond Vite (Next.js / Nuxt / Astro):** Provide runtime + source-location adapters for non-Vite dev servers (Turbopack, Webpack, Nitro).
- **Landing Page & Onboarding Polish:** Add an explicit comparison matrix vs. Playwright MCP / Chrome DevTools MCP, a real side-by-side IDE + browser walkthrough clip, and sharper visual hierarchy around daily HTML/CSS/React/Vue debugging before 3D/Stores.
- **Repro Test Export (Vitest / Playwright):** Generate full runnable test specs from `flightRecorder` + `activeMocks`.
- **New Adapters:** Svelte 5 runes/stores, Jotai, MobX, React Three Fiber `<JoltR3F />` component.
- **Optional Auto-Detection:** Lightweight DevTools hook when global stores or React/Vue DevTools are active.

---

## V2 — MCP UI / MCP Apps (`ui://` inside IDE Chat)

Leverage the **MCP Apps** specification (`@modelcontextprotocol/ext-apps`, sandboxed `ui://` iframe resources via `_meta.ui.resourceUri`, with progressive fallback to `< 280 token` JSON for CLI hosts):

- **`ui://jolt/inspector` (Live Box-Model & CSS Tuner):** Interactive card inside IDE chat showing box model, component hierarchy, and live sliders wired to `jolt_mutate_runtime`.
- **`ui://jolt/chaos` (Causal Timeline & Chaos Mocks):** Clickable `T-ms [click] → [fetch 500] → [error]` timeline with HTTP 4xx/5xx / `delayMs` toggles and 1-click test repro export.
- **`ui://jolt/webgl` (3D Scene & GPU Inspector):** Live FPS / `1% low` / `drawCalls` gauges and `x / y / z / scale / visible` sliders controlling browser Three.js meshes in real time.
- **`ui://jolt/session` (`LIVE` ↔ `Stop` Remote Control):** Persistent card displaying incoming `Alt + Click` pins, Spotlight CSS preview approvals, and a Stop handover button synced with `[STOP_LIVE]`.
