import type { IncomingMessage, ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { JOLT_ROUTES } from '../shared/constants.ts';
import type { JoltPluginOptions } from '../shared/types.ts';
import { injectSourceLocations } from '../transform/source-locator.ts';
import { JoltBridgeCore } from './bridge-core.ts';

/** Structural Vite plugin types so vite-plugin-jolt stays 100% zero-dependency at runtime. */
export interface ViteDevServerLike {
  config: { root?: string };
  middlewares: {
    use: (
      handler: (req: IncomingMessage, res: ServerResponse, next: (err?: unknown) => void) => void,
    ) => void;
  };
  httpServer?: {
    address: () => string | AddressInfo | null;
    once: (event: string, cb: () => void) => void;
  } | null;
  ws: {
    send: (payload: Record<string, unknown>) => void;
    on?: (event: string, cb: (data: unknown) => void) => void;
  };
}

export interface VitePluginLike {
  name: string;
  apply: 'serve' | 'build';
  enforce?: 'pre' | 'post';
  configResolved?: (config: { root?: string }) => void;
  transform?: (code: string, id: string) => { code: string; map: null } | null;
  transformIndexHtml?: (html: string, ctx?: { filename?: string }) => {
    html: string;
    tags: Array<{
      tag: string;
      attrs: Record<string, string>;
      injectTo: 'head' | 'body' | 'head-prepend' | 'body-prepend';
    }>;
  };
  configureServer?: (server: ViteDevServerLike) => void;
}

/**
 * Vite Dev-Time White-Box Plugin (`apply: 'serve'`, 0 bytes in production builds).
 * Injects source-location attributes, intercepts Vite compile errors server-side,
 * and mounts Jolt's pull-on-demand bridge endpoints.
 */
export function vitePluginJolt(options: JoltPluginOptions = {}): VitePluginLike {
  let rootDir = options.rootDir ?? process.cwd();
  const bridge = new JoltBridgeCore(rootDir, options);

  return {
    name: 'vite-plugin-jolt',
    apply: 'serve',
    // Run before @vitejs/plugin-react / vue / svelte so JSX/templates still have raw tags & line numbers.
    enforce: 'pre',

    configResolved(config) {
      if (config.root && !options.rootDir) {
        rootDir = config.root;
        bridge.setRootDir(rootDir);
      }
    },

    transform(code, id) {
      if (options.enabled === false) return null;
      const transformed = injectSourceLocations(code, id, rootDir);
      if (transformed === code) return null;
      return { code: transformed, map: null };
    },

    transformIndexHtml(html, ctx) {
      if (options.enabled === false) {
        return { html, tags: [] };
      }
      const filename = ctx?.filename ?? `${rootDir}/index.html`;
      const annotated = injectSourceLocations(html, filename, rootDir);
      return {
        html: annotated,
        tags: [
          {
            tag: 'script',
            attrs: { type: 'module', src: JOLT_ROUTES.PROBE_SCRIPT },
            injectTo: 'head-prepend',
          },
        ],
      };
    },

    configureServer(server) {
      if (options.enabled === false) return;

      // Capture Vite build/HMR errors directly on the Node server (survives broken client graphs).
      const origWsSend = server.ws.send.bind(server.ws);
      server.ws.send = (payload: Record<string, unknown>) => {
        if (payload?.type === 'error' && payload.err && typeof payload.err === 'object') {
          const err = payload.err as {
            message?: string;
            loc?: { file?: string; line?: number; column?: number };
            id?: string;
            frame?: string;
          };
          bridge.setCompileError({
            message: err.message ?? 'Unknown Vite compile error',
            file: err.loc?.file ?? err.id,
            line: err.loc?.line,
            column: err.loc?.column,
            frame: err.frame,
          });
        } else if (payload?.type === 'update' || payload?.type === 'full-reload') {
          bridge.setCompileError(null);
        }
        return origWsSend(payload);
      };

      server.middlewares.use((req, res, next) => {
        bridge
          .handleHttpRequest(req, res)
          .then((handled) => {
            if (!handled) next();
          })
          .catch((err) => next(err));
      });

      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        if (addr && typeof addr === 'object') {
          bridge.registerSession(addr.port, rootDir);
        }
      });

      const cleanup = () => bridge.unregisterSession();
      process.once('SIGINT', cleanup);
      process.once('SIGTERM', cleanup);
    },
  };
}
