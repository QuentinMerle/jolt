# Jolt ⚡ (`vite-plugin-jolt`)

**Local-First White-Box Dev Bridge** connecting your Vite/Node dev server, live browser runtime (DOM / React / Vue, Zustand / Pinia / Redux stores, `window.fetch`, Three.js / WebGL2), and AI coding agents via `.jolt/` & MCP.

- **100% Local-First Dev Tool**: zero external runtime dependencies, `apply: 'serve'` (**0 bytes in production**), automatic secret redaction.
- **Prompt Directly From the Browser (`<jolt-hud>`)**: send instructions to your agent without leaving Chrome/Safari — targeted via `Alt + Click` (DOM or 3D) or page-wide.
- **Automatic Source-Locator (`data-jolt-loc`) + React Fiber / Vue 3**: maps elements to `file:line:col` and extracts framework component chains.
- **Live Listening & Handover (`listening` ↔ `[STOP_LIVE]`)**: run an active watch session and click **Stop** in `<jolt-hud>` to hand control straight back to your IDE chat.
- **Plug & Play Adapters (`vite-plugin-jolt/adapters`)**: `joltZustand`, `joltPinia`, `joltPiniaStore`, `joltRedux`, and `joltThree`.
- **Visual Spotlight & Network Mocker**: preview CSS changes in memory before writing to disk, or inject HTTP 4xx/5xx responses and `delayMs` latency on the fly.

## Install & Agent Setup (30 seconds)

```bash
# 1. Install as a devDependency
npm install -D vite-plugin-jolt

# 2. Auto-configure AGENTS.md, .mcp.json, and .gitignore
npx jolt-mcp init --write
```

### `vite.config.ts`

```ts
import { vitePluginJolt } from 'vite-plugin-jolt';
export default { plugins: [vitePluginJolt()] };
```

### Connect Stores & Three.js (`vite-plugin-jolt/adapters`)

```ts
import { joltZustand, joltPinia, joltThree } from 'vite-plugin-jolt/adapters';

joltZustand('cart', useCartStore);
joltPinia(pinia);
joltThree(scene, camera);
```

## Contributing & Local Development

```bash
npm run build           # Compile src/ -> dist/ via Node 22 stripTypeScriptTypes
npm run dev:playground  # Start interactive demo on http://127.0.0.1:5173
npm test                # Run full unit & integration test suite
```

## Open Source & Contributions

Jolt is released under the **MIT** license ([LICENSE](LICENSE)) and is **open to contributions** on GitHub: [github.com/QuentinMerle/jolt](https://github.com/QuentinMerle/jolt).
See [CONTRIBUTING.md](CONTRIBUTING.md) to add framework/store adapters (Jotai, Svelte stores, R3F), enhance the HUD, or extend MCP support.

Further reading: [docs/GUIDE_ETAPES.md](docs/GUIDE_ETAPES.md), [AGENTS.md](AGENTS.md), and [skills/jolt/SKILL.md](skills/jolt/SKILL.md).
