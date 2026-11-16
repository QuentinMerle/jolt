import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  JOLT_LIMITS,
  JOLT_ROUTES,
  SESSIONS_FILE_PATH,
} from '../shared/constants.ts';
import { formatRelativeTimeline, sanitizePayload } from '../shared/sanitizer.ts';
import type {
  A11yCompactNode,
  CompileErrorInfo,
  FlightEvent,
  JoltDigest,
  JoltPluginOptions,
  JoltSessionEntry,
  NetworkMockRule,
  PinnedElement,
  ViewportMetrics,
  WebGLMetrics,
} from '../shared/types.ts';
import { buildProbeBundle } from '../client/probe-bundle.ts';

interface PendingPull {
  resolve: (data: unknown) => void;
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Framework-agnostic server core powering both the Vite plugin and the standalone dev server.
 * Maintains live white-box telemetry, SSE command channels, Pull-on-Demand state sync,
 * and local CSRF / Origin protection.
 */
export class JoltBridgeCore {
  readonly sessionToken: string;
  private port = 0;
  private rootDir: string;
  private url = '/';
  private compileError: CompileErrorInfo | null = null;
  private pinnedElements: PinnedElement[] = [];
  private flightRecorder: FlightEvent[] = [];
  private stores: Record<string, unknown> = {};
  private webgl: WebGLMetrics | null = null;
  private viewport: ViewportMetrics | null = null;
  private activeMocks: NetworkMockRule[] = [];
  private a11yTree: A11yCompactNode[] = [];
  private readonly sseClients = new Set<ServerResponse>();
  private readonly pendingPulls = new Map<string, PendingPull>();
  private readonly pinWaiters = new Set<{ resolve: (pin: PinnedElement | null) => void }>();
  private outboxWatcherTimer: ReturnType<typeof setInterval> | null = null;
  private lastOutboxMtime = 0;
  private lastOutboxId: string | null = null;
  private cachedProbeScript: string;
  private readonly joltDirOverride?: string;

  constructor(rootDir = process.cwd(), options: JoltPluginOptions = {}) {
    this.rootDir = rootDir;
    this.joltDirOverride = options.joltDir;
    this.sessionToken = crypto.randomUUID();
    this.cachedProbeScript = buildProbeBundle(this.sessionToken, options);
  }

  getPort(): number {
    return this.port;
  }

  getRootDir(): string {
    return this.rootDir;
  }

  setRootDir(nextRootDir: string): void {
    if (!nextRootDir || this.rootDir === nextRootDir) return;
    this.rootDir = nextRootDir;
    if (this.port > 0) {
      this.initFileBridge();
    }
  }

  sendSpotlight(spec: Record<string, unknown>, message?: string): { ok: boolean; id: string } {
    const id = `spot_${Date.now().toString(36)}`;
    const cleanSpec = sanitizePayload(spec) as Record<string, unknown>;
    const title = typeof cleanSpec.title === 'string' ? cleanSpec.title : 'Agent Spotlight';
    this.broadcastSse('jolt-command', {
      type: 'agent-reply',
      id,
      status: 'done',
      message: String(sanitizePayload(message || `⚡ ${title}`)),
      spotlight: cleanSpec,
    });
    return { ok: true, id };
  }

  setCompileError(err: CompileErrorInfo | null): void {
    this.compileError = err ? (sanitizePayload(err) as CompileErrorInfo) : null;
    this.syncDigestFile();
  }

  /** Registers an active dev server port into /tmp/jolt-sessions.json for MCP auto-discovery. */
  registerSession(port: number, rootDir = this.rootDir): void {
    this.port = port;
    this.rootDir = rootDir;
    const entry: JoltSessionEntry = {
      port,
      url: `http://127.0.0.1:${port}`,
      pid: process.pid,
      root: rootDir,
      token: this.sessionToken,
      updatedAt: Date.now(),
    };

    const existing = readSessionsRegistry().filter(
      (item) => item.port !== port && item.pid !== process.pid && isProcessAlive(item.pid),
    );
    existing.unshift(entry);
    try {
      fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(existing, null, 2), 'utf8');
    } catch {
      // Non-fatal if /tmp is unavailable.
    }

    this.initFileBridge();
  }

  unregisterSession(): void {
    if (this.outboxWatcherTimer) {
      clearInterval(this.outboxWatcherTimer);
      this.outboxWatcherTimer = null;
    }
    for (const res of this.sseClients) {
      res.end();
    }
    this.sseClients.clear();
    for (const pending of this.pendingPulls.values()) {
      clearTimeout(pending.timer);
      pending.resolve(null);
    }
    this.pendingPulls.clear();
    for (const waiter of [...this.pinWaiters]) {
      waiter.resolve(null);
    }
    this.pinWaiters.clear();

    const remaining = readSessionsRegistry().filter((item) => item.pid !== process.pid);
    try {
      fs.writeFileSync(SESSIONS_FILE_PATH, JSON.stringify(remaining, null, 2), 'utf8');
    } catch {
      // Non-fatal cleanup error.
    }
  }

  /** Returns the current in-memory digest without waiting for a browser round-trip. */
  getDigest(): JoltDigest {
    const timeline = formatRelativeTimeline(this.flightRecorder);
    const hasRecentError = timeline.some(
      (ev) =>
        ev.type === 'error' ||
        ev.type === 'console.error' ||
        (ev.type === 'fetch' && typeof ev.details?.status === 'number' && ev.details.status >= 400),
    );

    return {
      timestamp: Date.now(),
      url: this.url,
      port: this.port,
      healthy: !this.compileError && !hasRecentError,
      compileError: this.compileError,
      pinnedElements: this.pinnedElements,
      flightRecorder: timeline,
      stores: this.stores,
      webgl: this.webgl,
      ...(this.viewport ? { viewport: this.viewport } : {}),
      activeMocks: this.activeMocks,
      a11yTree: this.a11yTree,
    };
  }

  /** Pulls a fresh snapshot on-demand from connected browser tab(s), falling back after 250ms. */
  async requestFreshDigest(includeA11y = true): Promise<JoltDigest> {
    if (this.sseClients.size > 0) {
      const pulled = await this.sendPullCommand(
        'request-digest',
        { includeA11y },
        JOLT_LIMITS.PULL_TIMEOUT_MS,
      );
      if (pulled && typeof pulled === 'object') {
        this.applyClientDigest(pulled as Record<string, unknown>);
      }
    }
    return this.getDigest();
  }

  /** Inspects a live element by selector/loc or returns the latest Alt+Click pinned element. */
  async inspectElement(query: {
    selector?: string;
    loc?: string;
    pinnedIndex?: number;
  }): Promise<PinnedElement | null> {
    if (!query.selector && !query.loc) {
      const idx = query.pinnedIndex ?? 0;
      return this.pinnedElements[idx] ?? null;
    }

    if (this.sseClients.size === 0) {
      return null;
    }

    const result = await this.sendPullCommand(
      'inspect-element',
      { selector: query.selector, loc: query.loc },
      JOLT_LIMITS.PULL_TIMEOUT_MS,
    );
    return result ? (sanitizePayload(result) as PinnedElement) : null;
  }

  /** Executes a runtime store mutation, click, or cleanup and waits 60ms for post-effect verification. */
  async mutateRuntime(mutation: Record<string, unknown>): Promise<{
    outcome: unknown;
    digest: JoltDigest;
  }> {
    if (mutation.operation === 'clear_pins') {
      this.pinnedElements = [];
      return { outcome: { ok: true, cleared: true }, digest: this.getDigest() };
    }

    if (this.sseClients.size === 0) {
      return {
        outcome: { ok: false, error: 'No browser tab connected to Jolt SSE' },
        digest: this.getDigest(),
      };
    }

    const response = await this.sendPullCommand(
      'mutate-runtime',
      { mutation },
      JOLT_LIMITS.PULL_TIMEOUT_MS + 180,
    );

    if (response && typeof response === 'object') {
      const record = response as { outcome?: unknown; digest?: Record<string, unknown> };
      if (record.digest) {
        this.applyClientDigest(record.digest);
      }
      return {
        outcome: sanitizePayload(record.outcome ?? { ok: true }),
        digest: this.getDigest(),
      };
    }

    return {
      outcome: { ok: false, error: 'Timed out waiting for runtime mutation confirmation' },
      digest: this.getDigest(),
    };
  }

  /** Manages client-side window.fetch mock rules and pushes updates to connected browsers. */
  manageMocks(input: {
    action: 'add' | 'remove' | 'clear' | 'list';
    urlPattern?: string;
    method?: string;
    status?: number;
    delayMs?: number;
    responseBody?: unknown;
    ruleId?: string;
  }): NetworkMockRule[] {
    if (input.action === 'add' && input.urlPattern) {
      const rule: NetworkMockRule = {
        id: `mock_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
        urlPattern: input.urlPattern,
        method: input.method?.toUpperCase(),
        status: typeof input.status === 'number' ? input.status : 500,
        delayMs: typeof input.delayMs === 'number' ? input.delayMs : 0,
        responseBody: input.responseBody ?? { error: 'Mocked by Jolt', status: input.status ?? 500 },
        active: true,
        hitCount: 0,
      };
      this.activeMocks.push(rule);
      this.broadcastSse('jolt-command', { type: 'sync-mocks', mocks: this.activeMocks });
    } else if (input.action === 'remove' && input.ruleId) {
      this.activeMocks = this.activeMocks.filter((r) => r.id !== input.ruleId);
      this.broadcastSse('jolt-command', { type: 'sync-mocks', mocks: this.activeMocks });
    } else if (input.action === 'clear') {
      this.activeMocks = [];
      this.broadcastSse('jolt-command', { type: 'sync-mocks', mocks: this.activeMocks });
    }
    if (input.action !== 'list') {
      this.syncDigestFile();
    }
    return this.activeMocks;
  }

  /** Broadcasts an automatic HMR update (CSS hot-swap or full reload) to connected browsers. */
  notifyHmr(kind: 'css' | 'reload', file: string): void {
    this.broadcastSse('jolt-command', {
      type: 'hmr-update',
      kind,
      file,
      timestamp: Date.now(),
    });
  }

  /**
   * Connect/Node-HTTP compatible middleware handling all `/__jolt/*` and `/@jolt/probe.js` routes.
   * Returns `true` if the request was handled by Jolt, `false` otherwise.
   */
  async handleHttpRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const rawUrl = req.url ?? '/';
    const pathname = rawUrl.split('?')[0];

    if (!pathname.startsWith('/__jolt/') && pathname !== JOLT_ROUTES.PROBE_SCRIPT) {
      return false;
    }

    if (!this.isAuthorizedOrigin(req)) {
      sendJson(res, 403, { error: 'Forbidden origin for Jolt local endpoint' });
      return true;
    }

    if (pathname === JOLT_ROUTES.PROBE_SCRIPT) {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(this.cachedProbeScript);
      return true;
    }

    if (pathname === JOLT_ROUTES.EVENTS) {
      this.attachSseClient(req, res);
      return true;
    }

    if (pathname === JOLT_ROUTES.DIGEST && req.method === 'GET') {
      const includeA11y = !rawUrl.includes('a11y=0');
      const digest = await this.requestFreshDigest(includeA11y);
      sendJson(res, 200, digest);
      return true;
    }

    if (pathname === JOLT_ROUTES.CLIENT_REPORT && req.method === 'POST') {
      if (req.headers['x-jolt-token'] !== this.sessionToken) {
        sendJson(res, 403, { error: 'Invalid X-Jolt-Token' });
        return true;
      }
      const body = await readJsonBody(req);
      this.processClientReport(body);
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === JOLT_ROUTES.INSPECT && req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = await this.inspectElement(body as { selector?: string; loc?: string; pinnedIndex?: number });
      sendJson(res, 200, { element: result });
      return true;
    }

    if (pathname === JOLT_ROUTES.RPC && req.method === 'POST') {
      const body = await readJsonBody(req);
      const outcome = await this.mutateRuntime(body);
      sendJson(res, 200, outcome);
      return true;
    }

    if (pathname === JOLT_ROUTES.MOCK && (req.method === 'POST' || req.method === 'GET')) {
      if (req.method === 'GET') {
        sendJson(res, 200, { mocks: this.activeMocks });
        return true;
      }
      const body = await readJsonBody(req);
      const mocks = this.manageMocks(body as Parameters<JoltBridgeCore['manageMocks']>[0]);
      sendJson(res, 200, { mocks });
      return true;
    }

    if (pathname === JOLT_ROUTES.WAIT_PIN && req.method === 'GET') {
      const parsedUrl = new URL(rawUrl, 'http://localhost');
      const sinceParam = parsedUrl.searchParams.get('since');
      const sinceTs = sinceParam ? Number(sinceParam) : 0;
      const latest = this.pinnedElements[0];

      if (sinceTs > 0 && latest && latest.timestamp > sinceTs) {
        sendJson(res, 200, { pin: latest });
        return true;
      }

      req.setTimeout(0);
      res.setTimeout(0);

      let settled = false;
      const waiter = {
        resolve: (pin: PinnedElement | null) => {
          if (settled) return;
          settled = true;
          this.pinWaiters.delete(waiter);
          if (!res.writableEnded) {
            sendJson(res, 200, { pin });
          }
        },
      };
      this.pinWaiters.add(waiter);
      req.on('close', () => {
        if (!settled) {
          settled = true;
          this.pinWaiters.delete(waiter);
        }
      });
      return true;
    }

    if (pathname === JOLT_ROUTES.STATUS && req.method === 'POST') {
      const body = await readJsonBody(req);
      const status = typeof body.status === 'string' ? body.status : 'idle';
      const message = typeof body.message === 'string' ? body.message : '';
      this.broadcastSse('jolt-command', {
        type: 'agent-status',
        status,
        message: String(sanitizePayload(message)),
      });
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === JOLT_ROUTES.SPOTLIGHT && req.method === 'POST') {
      const body = await readJsonBody(req);
      const outcome = this.sendSpotlight(body, typeof body.statusMessage === 'string' ? body.statusMessage : undefined);
      sendJson(res, 200, outcome);
      return true;
    }

    sendJson(res, 404, { error: 'Unknown Jolt endpoint' });
    return true;
  }

  private isAuthorizedOrigin(req: IncomingMessage): boolean {
    const origin = req.headers.origin;
    if (!origin) {
      return true;
    }
    try {
      const parsed = new URL(origin);
      const isLocalHost = parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
      if (!isLocalHost) return false;
      if (this.port && parsed.port && Number(parsed.port) !== this.port) {
        return req.headers['x-jolt-token'] === this.sessionToken;
      }
      return true;
    } catch {
      return false;
    }
  }

  private attachSseClient(req: IncomingMessage, res: ServerResponse): void {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    });
    res.write(`event: jolt-command\ndata: ${JSON.stringify({ type: 'sync-mocks', mocks: this.activeMocks })}\n\n`);
    this.sseClients.add(res);

    req.on('close', () => {
      this.sseClients.delete(res);
    });
  }

  private broadcastSse(eventName: string, payload: unknown): void {
    const frame = `event: ${eventName}\ndata: ${JSON.stringify(payload)}\n\n`;
    for (const client of this.sseClients) {
      client.write(frame);
    }
  }

  private sendPullCommand(
    type: string,
    extra: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<unknown> {
    const requestId = `pull_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.pendingPulls.delete(requestId);
        resolve(null);
      }, timeoutMs);

      this.pendingPulls.set(requestId, { resolve, timer });
      this.broadcastSse('jolt-command', { type, requestId, ...extra });
    });
  }

  private processClientReport(body: Record<string, unknown>): void {
    const kind = body.kind;
    if (kind === 'pull-response' && typeof body.requestId === 'string') {
      const pending = this.pendingPulls.get(body.requestId);
      if (pending) {
        clearTimeout(pending.timer);
        this.pendingPulls.delete(body.requestId);
        pending.resolve(body.data ?? null);
      }
      return;
    }

    if (kind === 'pin' && body.data && typeof body.data === 'object') {
      const rawData = body.data as Record<string, unknown>;
      const pin = sanitizePayload(body.data) as PinnedElement;
      if (typeof rawData.note === 'string') {
        pin.note = rawData.note.slice(0, 800);
      }
      this.pinnedElements.unshift(pin);
      if (this.pinnedElements.length > JOLT_LIMITS.MAX_PINNED_ELEMENTS) {
        this.pinnedElements.length = JOLT_LIMITS.MAX_PINNED_ELEMENTS;
      }
      this.writeInboxFile(pin);
      this.syncDigestFile();

      if (pin.note === '[STOP_LIVE]') {
        this.broadcastSse('jolt-command', {
          type: 'agent-status',
          status: 'idle',
          message: 'Listening stopped — control returned',
        });
      } else {
        this.broadcastSse('jolt-command', {
          type: 'agent-status',
          status: 'working',
          message: '⏳ Sent to agent…',
        });
      }

      for (const waiter of [...this.pinWaiters]) {
        waiter.resolve(pin);
      }
      return;
    }

    if (kind === 'mocks-sync' && Array.isArray(body.data)) {
      this.activeMocks = sanitizePayload(body.data) as NetworkMockRule[];
      this.syncDigestFile();
      return;
    }

    if (kind === 'digest' && body.data && typeof body.data === 'object') {
      this.applyClientDigest(body.data as Record<string, unknown>);
      this.syncDigestFile();
    }
  }

  private getJoltDir(): string {
    return this.joltDirOverride ?? path.join(this.rootDir, '.jolt');
  }

  private initFileBridge(): void {
    if (this.outboxWatcherTimer) return;
    try {
      const dir = this.getJoltDir();
      fs.mkdirSync(dir, { recursive: true });
      const outboxPath = path.join(dir, 'outbox.json');
      if (fs.existsSync(outboxPath)) {
        this.lastOutboxMtime = fs.statSync(outboxPath).mtimeMs;
      }
      this.syncDigestFile();
      this.outboxWatcherTimer = setInterval(() => {
        void this.pollOutboxFile();
      }, 120);
      this.outboxWatcherTimer.unref();
    } catch {
      // Non-fatal if rootDir is read-only (e.g. unit test placeholder).
    }
  }

  private syncDigestFile(): void {
    if (!this.port) return;
    try {
      const dir = this.getJoltDir();
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'digest.json'), JSON.stringify(this.getDigest(), null, 2), 'utf8');
    } catch {
      // Ignore write errors in restricted environments.
    }
  }

  private writeInboxFile(pin: PinnedElement): void {
    try {
      const dir = this.getJoltDir();
      fs.mkdirSync(dir, { recursive: true });
      const full = this.getDigest();
      const payload = {
        ...pin,
        digest: {
          timestamp: full.timestamp,
          url: full.url,
          port: full.port,
          healthy: full.healthy,
          compileError: full.compileError,
          stores: full.stores,
          webgl: full.webgl,
          activeMocks: full.activeMocks,
          flightRecorder: full.flightRecorder.slice(-5),
        },
      };
      fs.writeFileSync(path.join(dir, 'inbox.json'), JSON.stringify(payload, null, 2), 'utf8');
    } catch {
      // Ignore write errors in restricted environments.
    }
  }

  private async pollOutboxFile(): Promise<void> {
    try {
      const outboxPath = path.join(this.getJoltDir(), 'outbox.json');
      if (!fs.existsSync(outboxPath)) return;
      const stat = fs.statSync(outboxPath);
      if (stat.mtimeMs === this.lastOutboxMtime) return;
      this.lastOutboxMtime = stat.mtimeMs;

      const raw = fs.readFileSync(outboxPath, 'utf8').trim();
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        id?: string;
        status?: string;
        message?: string;
        reply?: string;
        spotlight?: Record<string, unknown>;
        mock?: Parameters<JoltBridgeCore['manageMocks']>[0];
        mutation?: Record<string, unknown>;
      };

      const msgId = parsed.id ?? String(stat.mtimeMs);
      if (msgId === this.lastOutboxId) return;
      this.lastOutboxId = msgId;

      if (parsed.mock) {
        this.manageMocks(parsed.mock);
      }
      if (parsed.mutation) {
        await this.mutateRuntime(parsed.mutation);
      }

      this.broadcastSse('jolt-command', {
        type: 'agent-reply',
        id: msgId,
        status: parsed.status ?? 'done',
        message: String(sanitizePayload(parsed.message ?? '✅ Reply received')),
        reply: typeof parsed.reply === 'string' ? parsed.reply.slice(0, 2000) : '',
        ...(parsed.spotlight ? { spotlight: sanitizePayload(parsed.spotlight) } : {}),
      });
      this.syncDigestFile();
    } catch {
      // Ignore partial writes while agent is updating outbox.json.
    }
  }

  private applyClientDigest(raw: Record<string, unknown>): void {
    const clean = sanitizePayload(raw) as Record<string, unknown>;
    if (typeof clean.url === 'string') this.url = clean.url;
    if (Array.isArray(clean.flightRecorder)) {
      this.flightRecorder = clean.flightRecorder as FlightEvent[];
    }
    if (clean.stores && typeof clean.stores === 'object') {
      this.stores = clean.stores as Record<string, unknown>;
    }
    if (clean.webgl !== undefined) {
      this.webgl = clean.webgl as WebGLMetrics | null;
    }
    if (clean.viewport && typeof clean.viewport === 'object') {
      this.viewport = clean.viewport as ViewportMetrics;
    }
    if (Array.isArray(clean.activeMocks)) {
      // Preserve hit counts synced from browser while keeping server rules authoritative.
      const hitMap = new Map<string, number>();
      for (const item of clean.activeMocks as NetworkMockRule[]) {
        if (item.id) hitMap.set(item.id, item.hitCount ?? 0);
      }
      this.activeMocks = this.activeMocks.map((rule) => ({
        ...rule,
        hitCount: Math.max(rule.hitCount, hitMap.get(rule.id) ?? 0),
      }));
    }
    if (Array.isArray(clean.a11yTree)) {
      this.a11yTree = clean.a11yTree as A11yCompactNode[];
    }
  }
}

/** Reads active Jolt sessions from /tmp/jolt-sessions.json. */
export function readSessionsRegistry(): JoltSessionEntry[] {
  try {
    if (!fs.existsSync(SESSIONS_FILE_PATH)) {
      return [];
    }
    const raw = fs.readFileSync(SESSIONS_FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as JoltSessionEntry[]) : [];
  } catch {
    return [];
  }
}

function isProcessAlive(pid: number): boolean {
  if (!pid || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        const parsed = text ? JSON.parse(text) : {};
        resolve(typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {});
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}
