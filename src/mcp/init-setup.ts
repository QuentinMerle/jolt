import fs from 'node:fs';
import path from 'node:path';

export interface JoltInitResult {
  targetDir: string;
  mcpConfig: { mcpServers: { jolt: { command: string; args: string[] } } };
  agentsSection: string;
  writtenFiles: string[];
}

const JOLT_START_MARKER = '<!-- JOLT:START -->';
const JOLT_END_MARKER = '<!-- JOLT:END -->';

/** Builds the copy-ready `AGENTS.md` operating manual block for target projects. */
export function buildJoltAgentsSection(isCompiledDist: boolean): string {
  const listenCmd = isCompiledDist
    ? 'npx jolt-mcp listen'
    : 'node --experimental-strip-types ./src/server/wait-for-pin.ts';

  return [
    JOLT_START_MARKER,
    '# Jolt ⚡ — Local-First White-Box Dev Bridge',
    '',
    'This workspace runs **Jolt** in local dev (`apply: "serve"`, 0 bytes in prod).',
    'Prefer `.jolt/` files or `jolt-mcp` tools over browser screenshots or `curl` polling.',
    '',
    '## 1. Local Workspace Protocol (`.jolt/`)',
    '- `.jolt/digest.json` — Live snapshot: `pinnedElements[]`, `compileError`, `flightRecorder[]`, `stores`, `viewport`, `webgl`, `activeMocks[]`, `a11yTree[]`.',
    '- `.jolt/inbox.json` — Latest element or 3D mesh pinned via `Alt + Click` in `<jolt-hud>`.',
    '- `.jolt/outbox.json` — Agent → Browser push channel (`status`, `message`, optional `spotlight`, `mock`, `mutation`).',
    '',
    '## 2. Orb States & Listening Handover (`[STOP_LIVE]`)',
    '- `status: "listening"` — HUD enters `LIVE` mode and shows a **Stop** button.',
    '- `status: "working"` — Agent is analyzing/editing.',
    '- `status: "done"` (or `"alert"`) — Work complete or listening ended.',
    `- When running active watch (\`${listenCmd}\`), exit immediately without re-arming if \`inbox.json\` delivers \`note: "[STOP_LIVE]"\` (\`stoppedByUser: true\`) so the developer regains IDE chat control.`,
    '',
    '## 3. Store & 3D Adapters (`vite-plugin-jolt/adapters`)',
    '- `joltZustand(name, useStore)`, `joltPinia(pinia)`, `joltRedux(name, store)` — Expose state + callable actions.',
    '- `joltThree(scene, camera)` — Auto-projects Three.js / R3F meshes for `Alt + Click` 3D picking.',
    '',
    '## 4. MCP Tools (`jolt-mcp`)',
    '- `jolt_get_digest` · `jolt_inspect_element` · `jolt_mutate_runtime` · `jolt_mock_network` · `jolt_spotlight`',
    JOLT_END_MARKER,
  ].join('\n');
}

/** Builds the MCP server configuration entry adapted to built `dist/` vs local TypeScript source. */
export function buildMcpConfigEntry(serverScriptPath: string): {
  mcpServers: { jolt: { command: string; args: string[] } };
} {
  const isJs = serverScriptPath.endsWith('.js');
  return {
    mcpServers: {
      jolt: isJs
        ? { command: 'npx', args: ['-y', 'jolt-mcp'] }
        : { command: process.execPath, args: ['--experimental-strip-types', serverScriptPath] },
    },
  };
}

function upsertMarkedSection(existing: string, markedBlock: string): string {
  const startIdx = existing.indexOf(JOLT_START_MARKER);
  const endIdx = existing.indexOf(JOLT_END_MARKER);
  if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + JOLT_END_MARKER.length).trimStart();
    return [before, markedBlock, after].filter(Boolean).join('\n\n') + '\n';
  }
  const trimmed = existing.trimEnd();
  return trimmed ? `${trimmed}\n\n${markedBlock}\n` : `${markedBlock}\n`;
}

/**
 * Generates or merges `AGENTS.md`, `.mcp.json`, and `.gitignore` inside `targetDir` when `write` is true.
 */
export function applyJoltProjectSetup(
  targetDir: string,
  serverScriptPath: string,
  options: { write?: boolean } = {},
): JoltInitResult {
  const resolvedTarget = path.resolve(targetDir);
  const isCompiledDist = serverScriptPath.endsWith('.js');
  const mcpConfig = buildMcpConfigEntry(serverScriptPath);
  const agentsSection = buildJoltAgentsSection(isCompiledDist);
  const writtenFiles: string[] = [];

  if (options.write) {
    fs.mkdirSync(resolvedTarget, { recursive: true });

    // 1. AGENTS.md (non-destructive marked block)
    const agentsPath = path.join(resolvedTarget, 'AGENTS.md');
    const existingAgents = fs.existsSync(agentsPath) ? fs.readFileSync(agentsPath, 'utf8') : '';
    fs.writeFileSync(agentsPath, upsertMarkedSection(existingAgents, agentsSection), 'utf8');
    writtenFiles.push(agentsPath);

    // 2. .mcp.json (preserve other MCP servers)
    const mcpPath = path.join(resolvedTarget, '.mcp.json');
    let mergedMcp: { mcpServers?: Record<string, unknown>; [key: string]: unknown } = {};
    if (fs.existsSync(mcpPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(mcpPath, 'utf8'));
        if (parsed && typeof parsed === 'object') mergedMcp = parsed as typeof mergedMcp;
      } catch {
        mergedMcp = {};
      }
    }
    mergedMcp.mcpServers = {
      ...(mergedMcp.mcpServers ?? {}),
      ...mcpConfig.mcpServers,
    };
    fs.writeFileSync(mcpPath, `${JSON.stringify(mergedMcp, null, 2)}\n`, 'utf8');
    writtenFiles.push(mcpPath);

    // 3. .gitignore (ensure .jolt/ is ignored)
    const gitignorePath = path.join(resolvedTarget, '.gitignore');
    const existingIgnore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
    const hasJoltIgnore = existingIgnore
      .split(/\r?\n/)
      .some((line) => line.trim() === '.jolt' || line.trim() === '.jolt/');
    if (!hasJoltIgnore) {
      const prefix = existingIgnore.trimEnd();
      const nextIgnore = prefix ? `${prefix}\n.jolt/\n` : '.jolt/\n';
      fs.writeFileSync(gitignorePath, nextIgnore, 'utf8');
      writtenFiles.push(gitignorePath);
    }
  }

  return {
    targetDir: resolvedTarget,
    mcpConfig,
    agentsSection,
    writtenFiles,
  };
}
