import fs from 'node:fs';
import path from 'node:path';
import { stripTypeScriptTypes } from 'node:module';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const EXECUTABLE_ENTRIES = new Set(['mcp/jolt-mcp-server.js', 'server/wait-for-pin.js']);

function collectTsFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...collectTsFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      out.push(full);
    }
  }
  return out;
}

function rewriteRelativeImports(jsCode) {
  return jsCode.replace(/(from\s+['"])(\.[^'"]+)\.ts(['"])/g, '$1$2.js$3').replace(
    /(import\(\s*['"])(\.[^'"]+)\.ts(['"]\s*\))/g,
    '$1$2.js$3',
  );
}

const INDEX_DTS = `export { vitePluginJolt } from './server/vite-plugin-jolt.js';
export { JoltBridgeCore, readSessionsRegistry } from './server/bridge-core.js';
export { startStandaloneDevServer } from './server/standalone-dev-server.js';
export { injectSourceLocations } from './transform/source-locator.js';
export { sanitizePayload, formatRelativeTimeline } from './shared/sanitizer.js';
export { JOLT_ROUTES, JOLT_LIMITS, RADIO_CSS_PROPS } from './shared/constants.js';
export type * from './shared/types.js';
`;

const ADAPTERS_DTS = `export interface JoltStoreRegistration {
  getState: () => unknown;
  setState?: (partial: Record<string, unknown>) => void;
  actions?: Record<string, (...args: unknown[]) => unknown>;
}
export function joltZustand<T extends Record<string, unknown>>(name: string, store: {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}): () => void;
export function joltPiniaStore<T extends Record<string, unknown>>(store: {
  $id: string;
  $state: T;
  $patch: (partial: Partial<T>) => void;
  $subscribe?: (cb: (mutation: { type?: string; storeId?: string }, state: T) => void) => () => void;
  [key: string]: unknown;
}, nameOverride?: string): () => void;
export function joltPinia(pinia: { _s?: Map<string, any> }): () => void;
export function joltRedux<T = unknown>(
  name: string,
  store: { getState: () => T; dispatch: (action: { type: string; [key: string]: unknown }) => unknown; subscribe: (l: () => void) => () => void },
  actionCreators?: Record<string, (...args: unknown[]) => { type: string; [key: string]: unknown }>,
): () => void;
export function joltThree(
  scene: { traverse: (cb: (obj: any) => void) => void; updateMatrixWorld?: (force?: boolean) => void },
  camera: { matrixWorldInverse?: { elements: ArrayLike<number> }; projectionMatrix?: { elements: ArrayLike<number> }; updateMatrixWorld?: (force?: boolean) => void },
  options?: { domElement?: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number } } | null; storeName?: string | false; includeUnnamed?: boolean; maxNodes?: number },
): () => void;
`;

fs.rmSync(DIST_DIR, { recursive: true, force: true });
fs.mkdirSync(DIST_DIR, { recursive: true });

const files = collectTsFiles(SRC_DIR);
for (const srcFile of files) {
  const relTs = path.relative(SRC_DIR, srcFile);
  const relJs = relTs.replace(/\.ts$/, '.js').replace(/\\/g, '/');
  const outFile = path.join(DIST_DIR, relJs);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });

  const tsCode = fs.readFileSync(srcFile, 'utf8');
  const stripped = stripTypeScriptTypes(tsCode, { mode: 'strip', sourceUrl: srcFile });
  let finalJs = rewriteRelativeImports(stripped);

  if (EXECUTABLE_ENTRIES.has(relJs) && !finalJs.startsWith('#!')) {
    finalJs = `#!/usr/bin/env node\n${finalJs}`;
  }
  fs.writeFileSync(outFile, finalJs, 'utf8');
  if (EXECUTABLE_ENTRIES.has(relJs)) {
    fs.chmodSync(outFile, 0o755);
  }
}

fs.writeFileSync(path.join(DIST_DIR, 'index.d.ts'), INDEX_DTS, 'utf8');
fs.mkdirSync(path.join(DIST_DIR, 'adapters'), { recursive: true });
fs.writeFileSync(path.join(DIST_DIR, 'adapters', 'index.d.ts'), ADAPTERS_DTS, 'utf8');

console.log(`Built ${files.length} files to dist/`);
