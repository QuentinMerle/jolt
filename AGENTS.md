# Jolt ⚡ — Agent Operating Manual (`AGENTS.md`)

This workspace embeds **Jolt**, a local-first White-Box Dev Bridge connecting Vite/Node HTML/CSS/JS + WebGL2 runtime telemetry directly to AI agents with zero terminal network popups.

## 1. Local-First Workspace Protocol (`.jolt/`)

Never shell out to `curl` or `fetch('http://localhost:...')` to inspect or message the browser. Read and write workspace files directly:

- **`.jolt/digest.json`** — Live snapshot of the running app:
  - `pinnedElements[]`: Elements or 3D WebGL meshes pinned via `Alt + Click` (includes `note`, exact source `loc`, bounding `rect`, computed CSS radio `styles`, `parent`, and `componentChain`).
  - `webgl`: Live FPS, 1% low, draw calls, triangles, programs/buffers, and `sceneNodes[]` (`id`, `name`, `position`, `scale`, `color`, `screenRect`).
  - `stores`: Registered client stores (`state` + callable `actions`).
  - `flightRecorder[]`: Last 10 causal events (`T-ms [click|fetch|store|error|console.error]`).
  - `viewport`: Viewport dimensions and responsive `horizontalOverflow` status.
  - `activeMocks[]` & `a11yTree[]`.
- **`.jolt/inbox.json`** — Latest pin/prompt submitted from `<jolt-hud>`.
- **`.jolt/outbox.json`** — Agent → Browser push channel (watched every 120 ms by `JoltBridgeCore` and pushed over SSE).

## 2. Managing the Front-End Orb & Listening Handover Lifecycle

Jolt distinguishes three explicit front-end states via `.jolt/outbox.json` (each with a unique `id`):

- **`"status": "listening"`** — Active watch mode (`wait-for-pin.ts` / `jolt-mcp listen` writes this automatically on boot). The HUD displays `LIVE` and enables the **Stop** button so the developer can end listening anytime.
- **`"status": "working"`** — The agent received a pin and is actively analyzing or patching files.
- **`"status": "done"`** (or `"alert"`) — Work complete or listening stopped cleanly.

```json
{
  "id": "done_1",
  "status": "done",
  "message": "✅ Patch applied"
}
```

### Active Listening (`wait-for-pin.ts`) & User Handover (`[STOP_LIVE]`)

1. Start listening only when the developer asks for a live front-end loop (never block the chat silently without informing the user):
   `node --experimental-strip-types ./src/server/wait-for-pin.ts` (under `BypassSandbox: false`) or `npx jolt-mcp listen`.
2. When a user pin arrives in `.jolt/inbox.json`, handle it cleanly (`working` → edit → `done`), then ask or re-arm listening according to user intent.
3. **If `wait-for-pin.ts` returns `"note": "[STOP_LIVE]"` (`"stoppedByUser": true`)**, the developer clicked **Stop** in `<jolt-hud>` to retake control: **do NOT re-arm listening**. Confirm briefly in chat that front-end listening is paused and wait for the developer's next prompt.

## 3. Agent → Browser Visual Spotlight & Live CSS Preview (`spotlight`)

You can highlight any DOM element (`#selector` or `file:line:col`) **or 3D WebGL node** (`webgl:OrbitalTorus#item-2` or `item-2`), show an interactive guidance card, and optionally preview CSS changes in memory **before** touching disk:

```json
{
  "id": "spot_1",
  "status": "done",
  "message": "⚡ UI check",
  "spotlight": {
    "target": "#btn-checkout",
    "variant": "preview",
    "title": "CSS Preview",
    "message": "Switch this button to an indigo gradient?",
    "previewCss": {
      "background": "linear-gradient(135deg, #6366f1, #4f46e5)",
      "color": "#ffffff"
    },
    "confirmable": true,
    "confirmLabel": "✓ Apply on disk",
    "cancelLabel": "✕ Cancel",
    "keepPreviewOnConfirm": true,
    "notifyOnCancel": false
  }
}
```

Supported variants:
- `question` (Cyan) — Confirm ambiguity (*"Is this the block you mean?"*).
- `warning` (Amber) — Point out layout/perf/a11y risk (*"Watch this Flex container"*).
- `error` (Crimson) — Explain a blocker.
- `preview` (Emerald) — Temporary in-memory `previewCss` that cleanly reverts on Cancel and wakes the agent with `[SPOTLIGHT_CONFIRM]` on Confirm.

## 4. Runtime Mutations & Chaos Mocks (`.jolt/outbox.json` or MCP)

- **Via `.jolt/outbox.json`** (zero confirmation popup):
  - `"mock"`: `{ "action": "add" | "remove" | "clear", "urlPattern": "/api/checkout", "method": "POST", "status": 500, "responseBody": { ... } }`
  - `"mutation"`: `{ "operation": "store_action" | "store_set" | "click_element" | "clear_storage", "target": "joltLabStore", "action": "updateSceneNode", "payload": { "id": "item-2", "x": 1.2 } }`
- **Via MCP (`jolt-mcp`)**: `jolt_get_digest`, `jolt_inspect_element`, `jolt_mutate_runtime`, `jolt_mock_network`, `jolt_spotlight`.
