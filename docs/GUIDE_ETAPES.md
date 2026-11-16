# Step-by-Step Guide — Jolt ⚡ (`vite-plugin-jolt`)

This guide walks through Jolt's architecture, each module's responsibility, and how to run, test, and connect **Jolt ⚡** in any frontend project or agentic IDE.

---

## Step 1 — Repository Architecture

```text
jolt/
├── package.json                  # Zero-dependency ESM package (Node >= 22.6)
├── tsconfig.json                 # Strict TS config
├── scripts/build.mjs             # Zero-dep compiler (stripTypeScriptTypes -> dist/)
├── skills/jolt/SKILL.md          # Agent companion skill instructions
├── docs/GUIDE_ETAPES.md          # This guide
├── src/
│   ├── index.ts                  # Public Vite plugin & server exports
│   ├── adapters/                 # Plug & play Zustand, Pinia, Redux & Three.js bridges
│   ├── shared/
│   │   ├── constants.ts          # /__jolt/* routes, token limits, RADIO_CSS_PROPS
│   │   ├── types.ts              # JoltDigest, FlightEvent, PinnedElement, WebGLMetrics
│   │   └── sanitizer.ts          # Secret/token redaction + relative T-ms timeline
│   ├── transform/
│   │   └── source-locator.ts     # AST/Markup pass injecting data-jolt-loc="file:line:col"
│   ├── client/
│   │   ├── flight-recorder.ts    # Causal ring buffer (clicks, errors, console.error)
│   │   ├── dom-inspector.ts      # Compact A11y + Child/Parent CSS + React/Vue chain
│   │   ├── network-interceptor.ts# window.fetch wrapper + HTTP 4xx/5xx/delayMs mocker
│   │   ├── webgl-probe.ts        # Passive WebGL/WebGL2 probe (FPS, 1% low, drawCalls)
│   │   ├── jolt-hud.ts           # Shadow DOM <jolt-hud> + Alt+Click + LIVE/Stop
│   │   └── probe-bundle.ts       # Combines probes + SSE channel + window.__JOLT__
│   ├── server/
│   │   ├── bridge-core.ts        # Pull-on-Demand SSE, CSRF token, .jolt/ IPC
│   │   ├── vite-plugin-jolt.ts   # Vite plugin (apply: 'serve', captures build errors)
│   │   ├── standalone-dev-server.ts # Standalone Node HTTP server for static/Playground apps
│   │   └── wait-for-pin.ts       # Active listening CLI + [STOP_LIVE] handover
│   └── mcp/
│       ├── tools-schema.ts       # JSON Schema for the 5 Jolt MCP tools
│       ├── init-setup.ts         # Auto-configures AGENTS.md, .mcp.json & .gitignore
│       └── jolt-mcp-server.ts    # Stdio MCP JSON-RPC 2.0 server + CLI (`init`, `listen`)
├── playground/                   # Full interactive showcase (HTML/CSS/JS + Fetch + WebGL2)
└── tests/                        # Unit & integration test suites
```

---

## Step 2 — Run the Interactive Playground

> **Requirement:** Node.js `v22.6+` (no external `npm install` needed).

1. Start the dev server:
   ```bash
   npm run dev:playground
   ```
2. Open `http://127.0.0.1:5173` in your browser.
3. Click the floating **⚡ Jolt** capsule at bottom-right to inspect live FPS, draw calls, store state, or type an instruction directly from the browser.

---

## Step 3 — Explore Key Features in the Playground

### 3.1 — Real-Time WebGL2 Telemetry & 3D Picking
- Adjust **Speed**, switch **Palette**, or toggle **Wireframe**.
- Hold `Alt` over the 3D canvas to highlight individual meshes (`CryoOctahedron`, `OrbitalTorus`, `SolarPrism`) with zero per-frame allocations.

### 3.2 — Live API vs Mock HTTP 500
1. Click **Confirm & Pay — POST /api/checkout**: Node responds `200 OK`.
2. Click **Enable Mock HTTP 500** and pay again: Jolt intercepts `window.fetch`, updates the causal diagram live, returns `500`, and records the event in the Flight Recorder.

### 3.3 — Browser Prompting & `Alt + Click`
1. Hold `Alt` (or click the crosshair icon in the HUD) and click any DOM element or 3D mesh.
2. Type a note in the HUD and press Enter (`PIN ↵`): Jolt captures `file:line:col`, React/Vue component hierarchy, and comparative Child + Parent layout CSS.

### 3.4 — JSON Digest Preview (< 280 tokens target)
- Click **Inspect Digest** in the navbar (or `GET http://127.0.0.1:5173/__jolt/digest`) to inspect the exact payload sent to AI agents.
- Click **Trigger JS Crash** to verify uncaught exception recording.

---

## Step 4 — Build & Run Automated Tests

```bash
npm run build
npm test
```

---

## Step 5 — Connect Vite, Adapters & Your AI Agent (MCP + `AGENTS.md`)

### In Vite (`vite.config.ts`)
```ts
import { vitePluginJolt } from 'vite-plugin-jolt';

export default {
  plugins: [vitePluginJolt()],
};
```
*(Uses `apply: 'serve'`: 0 bytes bundled in production builds.)*

### Auto-Configure MCP + `AGENTS.md` (Antigravity / Cursor / Claude Code)
```bash
npx jolt-mcp init --write
```

### Live Listening & Control Handover (`[STOP_LIVE]`)
When the agent runs `npx jolt-mcp listen` (or `wait-for-pin.ts`), `<jolt-hud>` displays `LIVE` and reveals a **Stop** button. Clicking **Stop** emits `[STOP_LIVE]`, exits the listener cleanly, and hands control back to your IDE chat.

### Store & Three.js Adapters (`vite-plugin-jolt/adapters`)
- `joltZustand(name, useStore)` — exposes state, actions, and store events.
- `joltPinia(pinia)` / `joltPiniaStore(store)` — connects Vue 3 Pinia stores.
- `joltRedux(name, store, actionCreators?)` — connects Redux/RTK stores.
- `joltThree(scene, camera)` — auto-projects Three.js / R3F meshes into 2D `screenRect` boxes and registers `joltThreeScene`.

### 5 MCP Tools
1. `jolt_get_digest` — Unified white-box digest (compile errors, Flight Recorder, `Alt+Click` pins, stores, `viewport`, WebGL, A11y).
2. `jolt_inspect_element` — Exact `file:line:col` coordinate + Child/Parent CSS + React/Vue chain.
3. `jolt_mutate_runtime` — Mutate stores, dispatch actions, or click elements with 60 ms post-check.
4. `jolt_mock_network` — Add/remove `window.fetch` mocks (`4xx`/`5xx`/`delayMs`) on the fly.
5. `jolt_spotlight` — Highlight DOM or 3D targets in the browser with guidance cards and live in-memory CSS previews.
