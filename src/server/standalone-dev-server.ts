import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { JOLT_ROUTES } from '../shared/constants.ts';
import type { JoltPluginOptions } from '../shared/types.ts';
import { injectSourceLocations } from '../transform/source-locator.ts';
import { JoltBridgeCore } from './bridge-core.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

export interface StandaloneServerOptions {
  staticDir: string;
  rootDir?: string;
  port?: number;
  host?: string;
  jolt?: JoltPluginOptions;
}

export interface StandaloneServerInstance {
  server: http.Server;
  bridge: JoltBridgeCore;
  port: number;
  url: string;
  close: () => Promise<void>;
}

/**
 * Starts a zero-dependency Node HTTP dev server that serves a static HTML/CSS/JS app
 * with automatic `data-jolt-loc` AST injection, `/@jolt/probe.js` injection,
 * Jolt MCP bridge endpoints, and a demo `POST /api/checkout` endpoint.
 */
export async function startStandaloneDevServer(
  options: StandaloneServerOptions,
): Promise<StandaloneServerInstance> {
  const staticDir = path.resolve(options.staticDir);
  const rootDir = path.resolve(options.rootDir ?? staticDir);
  const host = options.host ?? '127.0.0.1';
  const requestedPort = options.port ?? 5173;
  const bridge = new JoltBridgeCore(rootDir, options.jolt);

  const server = http.createServer(async (req, res) => {
    try {
      const handled = await bridge.handleHttpRequest(req, res);
      if (handled) return;

      const pathname = (req.url ?? '/').split('?')[0];

      // Demo API endpoint for testing real 200 OK vs Jolt Mock 500
      if (pathname === '/api/checkout' && req.method === 'POST') {
        const chunks: Buffer[] = [];
        req.on('data', (chunk: Buffer) => chunks.push(chunk));
        req.on('end', () => {
          let payload: Record<string, unknown> = {};
          try {
            payload = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as Record<string, unknown>;
          } catch {
            payload = {};
          }
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(
            JSON.stringify({
              ok: true,
              orderId: `ORD-${Date.now().toString(36).toUpperCase()}`,
              total: payload.total ?? 0,
              plan: payload.plan ?? 'indie',
              source: 'live-node-backend',
            }),
          );
        });
        return;
      }

      const relPath = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
      const resolved = path.resolve(staticDir, relPath);
      if (!resolved.startsWith(staticDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }

      if (!fs.existsSync(resolved) || fs.statSync(resolved).isDirectory()) {
        res.writeHead(404);
        res.end('Not Found');
        return;
      }

      const ext = path.extname(resolved).toLowerCase();
      const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';

      if (ext === '.html' || ext === '.htm') {
        const rawHtml = fs.readFileSync(resolved, 'utf8');
        let html = injectSourceLocations(rawHtml, resolved, rootDir);
        const probeTag = `<script type="module" src="${JOLT_ROUTES.PROBE_SCRIPT}"></script>`;
        if (html.includes('<head>')) {
          html = html.replace('<head>', `<head>\n  ${probeTag}`);
        } else {
          html = `${probeTag}\n${html}`;
        }
        res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
        res.end(html);
        return;
      }

      const content = fs.readFileSync(resolved);
      res.writeHead(200, { 'Content-Type': contentType, 'Cache-Control': 'no-store' });
      res.end(content);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }));
    }
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(requestedPort, host, () => resolve());
  });

  const addr = server.address() as AddressInfo;
  const boundPort = addr.port;
  bridge.registerSession(boundPort, rootDir);

  let hmrTimer: ReturnType<typeof setTimeout> | null = null;
  let watcher: fs.FSWatcher | null = null;
  try {
    watcher = fs.watch(staticDir, (_event, filename) => {
      if (!filename || filename.startsWith('.')) return;
      if (hmrTimer) clearTimeout(hmrTimer);
      hmrTimer = setTimeout(() => {
        const ext = path.extname(filename).toLowerCase();
        if (ext === '.css') {
          bridge.notifyHmr('css', filename);
        } else if (ext === '.html' || ext === '.htm' || ext === '.js' || ext === '.mjs') {
          bridge.notifyHmr('reload', filename);
        }
      }, 80);
    });
    watcher.unref();
  } catch {
    // Ignore watcher errors if platform/sandbox restricts fs.watch.
  }

  return {
    server,
    bridge,
    port: boundPort,
    url: `http://${host}:${boundPort}`,
    close: async () => {
      if (hmrTimer) {
        clearTimeout(hmrTimer);
        hmrTimer = null;
      }
      watcher?.close();
      watcher = null;
      bridge.unregisterSession();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    },
  };
}
