---
name: jolt
description: White-Box Dev Bridge for Vite & WebGL2 apps. Use FIRST instead of taking screenshots or heavy browser snapshots when debugging compile/runtime errors, locating source files (data-jolt-loc), inspecting Alt+Click elements, reading/mutating front-end stores, inspecting WebGL GPU metrics, or mocking HTTP 4xx/5xx fetch errors.
---

# Jolt ⚡ — White-Box Dev Bridge

Use **Jolt** whenever a local dev server running `vite-plugin-jolt` (or the standalone Jolt server) is active. Jolt complements black-box browser automation (`browser` / Chrome DevTools MCP) by giving you direct < 5 ms visibility inside the compiler and front-end runtime.

## When to use Jolt vs Browser Subagent

- **Use Jolt (`jolt_get_digest`, `jolt_inspect_element`, `jolt_mutate_runtime`, `jolt_mock_network`, `jolt_spotlight`)** for:
  - Checking Vite compile errors, runtime JS crashes, or the **10-event causal Flight Recorder**.
  - Finding the exact `file:line:col` source coordinate (`data-jolt-loc`) of any UI node or `Alt + Click` pinned element.
  - Reading comparative Child + Parent layout CSS (`display`, `position`, `flex`, `grid`, `overflow`).
  - Inspecting WebGL2/Three.js GPU metrics (`fps`, `fps1Low`, `drawCallsPerFrame`, `trianglesPerFrame`, `sceneNodes`).
  - Mutating front-end stores directly or mocking `window.fetch` responses (e.g., HTTP 500 error).
- **Use Browser Subagent / Chrome DevTools** for multi-page navigation, visual screenshots, or external sites without Jolt.

## Standard Workflow

1. Call `jolt_get_digest` first to read `healthy`, `compileError`, `pinnedElements` (from developer `Alt + Click`), `flightRecorder`, `stores`, `viewport`, and `webgl`.
2. If `pinnedElements` is non-empty or you need layout CSS on a node, call `jolt_inspect_element`.
3. To test error handling without editing backend code, call `jolt_mock_network` with `{ action: "add", urlPattern: "/api/...", status: 500 }`, trigger the action with `jolt_mutate_runtime`, then inspect `jolt_get_digest`.
4. **Live Listening & Handover:** When running `wait-for-pin`, Jolt puts `<jolt-hud>` in `listening` (`LIVE`) mode so the developer sees a **Stop** button. If `.jolt/inbox.json` emits `note: "[STOP_LIVE]"` (`stoppedByUser: true`), stop listening immediately and return control to the IDE chat.
