# Jolt ⚡ (`vite-plugin-jolt`)

**Local-First White-Box Dev Bridge** connecting your Vite/Node dev server, live browser runtime (DOM, React/Vue components, Zustand/Pinia/Redux stores, `window.fetch`, Three.js/WebGL2), and AI coding agents via `.jolt/` & MCP.

> **54.1 KB** npm tarball · **0** dependencies · **~19.4 KB gzipped** dev probe (`apply: 'serve'` → **0 bytes in production**) · MIT Open Source

---

## Why Jolt?

Most AI coding workflows debug UI blindly: you paste 4 MB Retina screenshots (~1,500+ vision tokens), copy-paste console errors, and switch back and forth between browser and IDE.

Jolt runs directly **inside your real dev browser tab** and streams structured white-box runtime context to your agent in **~250–300 tokens**:

| Capability | Manual Screenshots | Headless Browser MCP | **Jolt ⚡** |
| --- | --- | --- | --- |
| Runs in your real Chrome / Safari tab | ✅ | ❌ Separate headless browser | ✅ |
| Exact `file:line:col` + React/Vue `componentChain` | ❌ | ❌ | ✅ (`data-jolt-loc`) |
| Token budget per check | ~1,500+ vision tokens | Heavy DOM/accessibility dumps | **~250–300 tokens** |
| Vite HMR compile errors captured server-side | ❌ | ❌ | ✅ |
| Zustand / Pinia / Redux live state + actions | ❌ | ❌ | ✅ (`vite-plugin-jolt/adapters`) |
| WebGL2 / Three.js FPS (`1% low`), draw calls & 3D picking | ❌ | ❌ | ✅ |
| Visual in-memory CSS preview before editing disk | ❌ | ❌ | ✅ (`Spotlight`) |
| Browser → IDE prompting + 1-click `Stop` handover | ❌ | ❌ | ✅ (`<jolt-hud>`) |
| Footprint & dependencies | — | Heavy Chromium / Playwright binary | **54.1 KB package · 0 deps · 0 B prod** |

---

## Install & Setup (30 Seconds)

### 1. Install as a `devDependency`

```bash
npm install -D vite-plugin-jolt
```

### 2. Auto-configure your project for AI agents

```bash
npx jolt-mcp init --write
```

This idempotently updates:
- `AGENTS.md` (marked `<!-- JOLT:START --> ... <!-- JOLT:END -->` operating guide)
- `.mcp.json` (adds the `jolt` stdio MCP server without overwriting existing servers)
- `.gitignore` (adds `.jolt/`)

### 3. Enable the Vite plugin (`vite.config.ts`)

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vitePluginJolt } from 'vite-plugin-jolt';

export default defineConfig({
  // Jolt enforces `apply: 'serve'` (0 prod bytes) and `enforce: 'pre'`
  plugins: [react(), vitePluginJolt()],
});
```

---

## How It Works (Local-First Architecture)

Everything stays on your machine — no cloud relay, no Chrome extension to maintain, and zero terminal network popups for sandboxed agents:

```text
┌──────────────────────────────┐        120ms SSE + POST        ┌──────────────────────────┐
│  Browser Dev Tab             │ ◄────────────────────────────► │  Vite Plugin / Node      │
│  • <jolt-hud> (Shadow DOM)   │                                │  • enforce: 'pre' loc    │
│  • Alt+Click DOM & 3D Pick   │                                │  • HMR compile errors    │
│  • Flight Recorder + fetch   │                                │  • .jolt/digest.json     │
│  • Stores & WebGL2 Telemetry │                                │  • .jolt/inbox|outbox    │
└──────────────────────────────┘                                └────────────┬─────────────┘
                                                                             │
                                                        .jolt/ files or MCP  │
                                                                             ▼
                                                                ┌──────────────────────────┐
                                                                │  AI Agent (IDE / CLI)    │
                                                                │  Cursor · Claude Code    │
                                                                │  Antigravity · Codex     │
                                                                └──────────────────────────┘
```

- **`.jolt/digest.json`**: Live snapshot (`pinnedElements[]`, `compileError`, `flightRecorder[]`, `stores`, `viewport`, `webgl`, `activeMocks[]`, `a11yTree[]`).
- **`.jolt/inbox.json`**: Latest pin or browser prompt sent from `<jolt-hud>`.
- **`.jolt/outbox.json`**: Agent → Browser push channel (`status`, `message`, `spotlight`, `mock`, `mutation`).

---

## Key Workflows

### 1. Prompt From the Browser (`<jolt-hud>`) & `Alt + Click`
- Hold **`Alt + Click`** on any DOM element or Three.js mesh (or type directly inside the `<jolt-hud>` prompt input) to send targeted context to your agent without leaving Chrome or Safari.
- Captures exact source coordinates (`data-jolt-loc="src/Card.tsx:14:5"`), bounding rect, filtered layout CSS (`styles` + parent), React Fiber / Vue 3 component chain, and viewport overflow metrics.

### 2. Live Listening & 1-Click IDE Handover (`LIVE` ↔ `[STOP_LIVE]`)
When running an active watch loop:

```bash
npx jolt-mcp listen
```

The browser HUD switches to **`LIVE`** (`status: "listening"`) and exposes a **Stop** button. Clicking **Stop** sends `note: "[STOP_LIVE]"` (`stoppedByUser: true`), exits the listener cleanly, and hands chat control straight back to your IDE.

### 3. Agent → Browser Visual Spotlight & In-Memory CSS Preview
Before touching files on disk, your agent can call `jolt_spotlight` (or write to `.jolt/outbox.json`) to highlight any DOM element or 3D mesh with a floating card:
- **`question`** — Confirm selector/element ambiguity.
- **`warning` / `error`** — Surface layout, perf, or runtime risks directly on the element.
- **`preview`** — Apply temporary in-memory `previewCss` styles with **Apply on disk** / **Cancel** buttons.

### 4. Chaos Network Mocker & Causal Flight Recorder
Ask your agent to simulate failures without writing a mock server (`jolt_mock_network`):
- Inject HTTP status codes (`404`, `429`, `500`), artificial `delayMs` latency, and custom JSON responses on matching `window.fetch` routes.
- `flightRecorder` captures the last 10 causal events (`T-ms [click | fetch | store | mock | error | console.error]`) leading up to an error.

### 5. WebGL2 & Three.js GPU Telemetry
Automatically instruments WebGL / WebGL2 contexts to report `fps`, `fps1Low`, `drawCallsPerFrame`, `trianglesPerFrame`, `programs`, `textures`, and `buffers` alongside projected 3D `sceneNodes[]`.

---

## Plug & Play Adapters (`vite-plugin-jolt/adapters`)

All client adapters become zero-cost no-ops whenever `window.__JOLT__` is absent (e.g., production builds).

```ts
import {
  joltZustand,
  joltPinia,
  joltPiniaStore,
  joltRedux,
  joltThree,
} from 'vite-plugin-jolt/adapters';

// React / Zustand (automatically separates state from callable actions)
joltZustand('cart', useCartStore);

// Vue 3 / Pinia (all stores or a single store)
joltPinia(pinia);
joltPiniaStore(useCheckoutStore());

// Redux / Redux Toolkit
joltRedux('app', store);

// Three.js / React Three Fiber (projects named meshes + `userData.joltId` for 3D Alt+Click)
joltThree(scene, camera, { maxNodes: 15 });
```

---

## MCP Tools (`jolt-mcp`)

Add to `.mcp.json` (or run `npx jolt-mcp init --write`):

```json
{
  "mcpServers": {
    "jolt": {
      "command": "npx",
      "args": ["-y", "jolt-mcp"]
    }
  }
}
```

| Tool | Purpose |
| --- | --- |
| `jolt_get_digest` | Fetch compact runtime snapshot: compile error, Flight Recorder, pins, stores, WebGL telemetry, mocks, viewport, and compact A11y tree. |
| `jolt_inspect_element` | Inspect a target by CSS selector, `data-jolt-loc`, or latest `Alt + Click` pin (`rect`, child + parent CSS, component chain). |
| `jolt_mutate_runtime` | Trigger `store_action`, patch state (`store_set`), simulate `click_element`, `clear_storage`, or `clear_pins`. |
| `jolt_mock_network` | Add, list, remove, or clear `window.fetch` mock rules (`status`, `delayMs`, `responseBody`). |
| `jolt_spotlight` | Highlight a DOM selector / `file:line:col` / 3D node with a `question`, `warning`, `error`, or interactive `previewCss` card. |

---

## Security & Zero-Prod Guarantees

- **Dev-Only Plugin (`apply: 'serve'`)**: Stripped completely from Vite production bundles (`0` bytes in `vite build`).
- **Automatic Redaction**: Sensitive keys (`password`, `token`, `secret`, `apiKey`, `authorization`, cookies, password `<input>` values) are redacted via `sanitizePayload()` before reaching `.jolt/` or MCP.
- **Local Loopback Security**: Per-session CSRF token (`x-jolt-token`) and strict `localhost` / `127.0.0.1` origin validation.

---

## Local Development & Playground

Requirements: Node.js `>=22.6.0` for contributor `--experimental-strip-types` dev/test scripts (compiled package `dist/` supports Node.js `>=20.0.0`).

```bash
npm run build           # Compile src/ -> dist/ via Node stripTypeScriptTypes
npm run dev:playground  # Start interactive demo on http://127.0.0.1:5173
npm test                # Run full unit & integration test suite
```

---

## Open Source & Contributions

Jolt is released under the **MIT** license ([LICENSE](LICENSE)) and is **open to contributions** on GitHub: [github.com/QuentinMerle/jolt](https://github.com/QuentinMerle/jolt).

- See [CONTRIBUTING.md](CONTRIBUTING.md) to add framework/store adapters (Jotai, Svelte 5 stores, `<JoltR3F />`), extend MCP Apps (`ui://`), or improve AST source-location.
- See [ROADMAP.md](ROADMAP.md) for upcoming V1.1 / V2 milestones.
- Further reading: [AGENTS.md](AGENTS.md), [docs/GUIDE_ETAPES.md](docs/GUIDE_ETAPES.md), and [skills/jolt/SKILL.md](skills/jolt/SKILL.md).
