#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import { JOLT_ROUTES } from '../shared/constants.ts';
import { readSessionsRegistry } from '../server/bridge-core.ts';
import { startWaitForPinLoop } from '../server/wait-for-pin.ts';
import { applyJoltProjectSetup } from './init-setup.ts';
import { JOLT_MCP_TOOLS } from './tools-schema.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

/** Resolves the target Jolt dev server base URL from explicit port, env var, or /tmp/jolt-sessions.json. */
export function resolveTargetServerUrl(preferredPort?: number): string {
  if (preferredPort) {
    return `http://127.0.0.1:${preferredPort}`;
  }
  if (process.env.JOLT_URL) {
    return process.env.JOLT_URL.replace(/\/+$/, '');
  }
  const sessions = readSessionsRegistry();
  if (sessions.length > 0) {
    const sorted = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
    return sorted[0].url;
  }
  const fallbackPort = process.env.JOLT_PORT ? Number(process.env.JOLT_PORT) : 5173;
  return `http://127.0.0.1:${fallbackPort}`;
}

async function callJoltHttp(
  url: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<unknown> {
  const res = await fetch(url, {
    method,
    headers: method === 'POST' ? { 'Content-Type': 'application/json' } : undefined,
    body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Jolt HTTP ${res.status}: ${text}`);
  }
  return text ? JSON.parse(text) : {};
}

/** Dispatches a single MCP JSON-RPC request and returns the response payload (or null for notifications). */
export async function handleJsonRpcMessage(
  msg: JsonRpcRequest,
): Promise<Record<string, unknown> | null> {
  if (!msg || msg.jsonrpc !== '2.0' || !msg.method) {
    return {
      jsonrpc: '2.0',
      id: msg?.id ?? null,
      error: { code: -32600, message: 'Invalid JSON-RPC request' },
    };
  }

  // Notifications have no id and expect no reply.
  if (msg.id === undefined || msg.method === 'notifications/initialized') {
    return null;
  }

  if (msg.method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: { listChanged: false },
        },
        serverInfo: {
          name: 'vite-plugin-jolt',
          version: '0.1.0',
        },
      },
    };
  }

  if (msg.method === 'ping') {
    return { jsonrpc: '2.0', id: msg.id, result: {} };
  }

  if (msg.method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id: msg.id,
      result: { tools: JOLT_MCP_TOOLS },
    };
  }

  if (msg.method === 'tools/call') {
    const params = msg.params ?? {};
    const toolName = String(params.name ?? '');
    const args = (params.arguments && typeof params.arguments === 'object'
      ? params.arguments
      : {}) as Record<string, unknown>;
    const port = typeof args.port === 'number' ? args.port : undefined;
    const baseUrl = resolveTargetServerUrl(port);

    try {
      let data: unknown;
      if (toolName === 'jolt_get_digest') {
        const a11yParam = args.includeA11y === false ? '?a11y=0' : '';
        data = await callJoltHttp(`${baseUrl}${JOLT_ROUTES.DIGEST}${a11yParam}`, 'GET');
      } else if (toolName === 'jolt_inspect_element') {
        data = await callJoltHttp(`${baseUrl}${JOLT_ROUTES.INSPECT}`, 'POST', {
          selector: args.selector,
          loc: args.loc,
          pinnedIndex: args.pinnedIndex,
        });
      } else if (toolName === 'jolt_mutate_runtime') {
        data = await callJoltHttp(`${baseUrl}${JOLT_ROUTES.RPC}`, 'POST', {
          operation: args.operation,
          target: args.target,
          action: args.action,
          payload: args.payload,
        });
      } else if (toolName === 'jolt_mock_network') {
        data = await callJoltHttp(`${baseUrl}${JOLT_ROUTES.MOCK}`, 'POST', {
          action: args.action,
          urlPattern: args.urlPattern,
          method: args.method,
          status: args.status,
          delayMs: args.delayMs,
          responseBody: args.responseBody,
          ruleId: args.ruleId,
        });
      } else if (toolName === 'jolt_spotlight') {
        data = await callJoltHttp(`${baseUrl}${JOLT_ROUTES.SPOTLIGHT}`, 'POST', {
          target: args.target,
          variant: args.variant,
          title: args.title,
          message: args.message,
          previewCss: args.previewCss,
          confirmable: args.confirmable,
          confirmLabel: args.confirmLabel,
          cancelLabel: args.cancelLabel,
          keepPreviewOnConfirm: args.keepPreviewOnConfirm,
          notifyOnCancel: args.notifyOnCancel,
        });
      } else {
        return {
          jsonrpc: '2.0',
          id: msg.id,
          error: { code: -32601, message: `Unknown tool: ${toolName}` },
        };
      }

      return {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
        },
      };
    } catch (err) {
      return {
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Jolt MCP error contacting ${baseUrl}: ${err instanceof Error ? err.message : String(err)}`,
            },
          ],
        },
      };
    }
  }

  return {
    jsonrpc: '2.0',
    id: msg.id,
    error: { code: -32601, message: `Method not found: ${msg.method}` },
  };
}

const THIS_FILE = fileURLToPath(import.meta.url);
const THIS_DIR = path.dirname(THIS_FILE);

function printInitInstructions(argv: string[] = process.argv): void {
  const dirFlagIdx = argv.indexOf('--dir');
  const targetDir =
    dirFlagIdx !== -1 && argv[dirFlagIdx + 1] ? path.resolve(argv[dirFlagIdx + 1]) : process.cwd();
  const shouldWrite = argv.includes('--write') || argv.includes('-w');
  const setup = applyJoltProjectSetup(targetDir, THIS_FILE, { write: shouldWrite });
  const packageRoot = path.resolve(THIS_DIR, '..', '..');

  const lines = [
    'Jolt ⚡ MCP & AGENTS.md Setup',
    '-----------------------------',
  ];
  if (shouldWrite) {
    lines.push(`Configured files in ${setup.targetDir}:`);
    for (const file of setup.writtenFiles) {
      lines.push(`  ✓ ${path.relative(setup.targetDir, file) || file}`);
    }
    lines.push('');
  } else {
    lines.push('1) Add to .mcp.json (Cursor / Claude Code / Antigravity):', '');
    lines.push(JSON.stringify(setup.mcpConfig, null, 2), '');
    lines.push('2) Add to AGENTS.md:', '');
    lines.push(setup.agentsSection, '');
    lines.push('Tip: run with `--write` to update AGENTS.md, .mcp.json, and .gitignore automatically.', '');
  }
  lines.push(`Companion Skill: ${path.join(packageRoot, 'skills', 'jolt', 'SKILL.md')}`, '');
  process.stdout.write(lines.join('\n'));
}

function startStdioLoop(): void {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });

  rl.on('line', async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    try {
      const parsed = JSON.parse(trimmed) as JsonRpcRequest;
      const response = await handleJsonRpcMessage(parsed);
      if (response) {
        process.stdout.write(`${JSON.stringify(response)}\n`);
      }
    } catch (err) {
      const parseErr = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
        },
      };
      process.stdout.write(`${JSON.stringify(parseErr)}\n`);
    }
  });
}

function isExecutedAsMain(filePath: string): boolean {
  if (!process.argv[1]) return false;
  try {
    return fs.realpathSync(process.argv[1]) === fs.realpathSync(filePath);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(filePath);
  }
}

// Run CLI only when executed directly (including via npm .bin symlinks, not when imported by tests).
const isMain = isExecutedAsMain(THIS_FILE);
if (isMain) {
  if (process.argv.includes('init')) {
    printInitInstructions(process.argv);
  } else if (process.argv.includes('listen')) {
    const inboxIdx = process.argv.indexOf('--inbox');
    const inboxOverride = inboxIdx !== -1 ? process.argv[inboxIdx + 1] : undefined;
    startWaitForPinLoop(inboxOverride);
  } else {
    startStdioLoop();
  }
}
