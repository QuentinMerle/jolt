import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it } from 'node:test';
import { JOLT_LOC_ATTR, JOLT_ROUTES } from '../src/shared/constants.ts';
import { formatRelativeTimeline, sanitizePayload } from '../src/shared/sanitizer.ts';
import { injectSourceLocations } from '../src/transform/source-locator.ts';
import { startStandaloneDevServer } from '../src/server/standalone-dev-server.ts';
import { vitePluginJolt } from '../src/server/vite-plugin-jolt.ts';
import { handleJsonRpcMessage } from '../src/mcp/jolt-mcp-server.ts';

describe('Source Locator (AST/Markup transform)', () => {
  it('annotates HTML elements with relative file:line:col and skips script/style blocks', () => {
    const root = '/repo';
    const html = [
      '<html>',
      '<body>',
      '  <div id="app">',
      '    <button class="cta">Buy</button>',
      '  </div>',
      '  <script>const tag = "<div>ignore me</div>";</script>',
      '  <style>div { color: red; }</style>',
      '  <div data-jolt-loc="manual:1:1">Existing</div>',
      '</body>',
      '</html>',
    ].join('\n');

    const result = injectSourceLocations(html, '/repo/playground/index.html', root);

    assert.ok(result.includes(`${JOLT_LOC_ATTR}="playground/index.html:3:3"`));
    assert.ok(result.includes(`${JOLT_LOC_ATTR}="playground/index.html:4:5"`));
    assert.ok(result.includes('<script>const tag = "<div>ignore me</div>";</script>'));
    assert.ok(result.includes('<style>div { color: red; }</style>'));
    assert.ok(result.includes('<div data-jolt-loc="manual:1:1">Existing</div>'));
    assert.equal(result.match(/manual:1:1/g)?.length, 1);
  });

  it('annotates JSX/TSX elements without breaking TypeScript generics', () => {
    const root = '/repo';
    const tsx = [
      'export function Card() {',
      '  const items: Array<string> = [];',
      '  return <section className="card"><button>Go</button><p>It\'s <span>fine</span></p></section>;',
      '}',
    ].join('\n');

    const result = injectSourceLocations(tsx, '/repo/src/Card.tsx', root);
    assert.ok(result.includes('Array<string>'));
    assert.ok(result.includes('<section className="card" data-jolt-loc="src/Card.tsx:3:10">'));
    assert.ok(result.includes('<button data-jolt-loc="src/Card.tsx:3:36">Go</button>'));
    assert.ok(result.includes('<span data-jolt-loc="src/Card.tsx:3:63">fine</span>'));
  });

  it('ignores node_modules files', () => {
    const html = '<button>Third Party</button>';
    const result = injectSourceLocations(html, '/repo/node_modules/pkg/index.html', '/repo');
    assert.equal(result, html);
  });
});

describe('Sanitizer & Relative Timeline', () => {
  it('redacts sensitive keys recursively and handles circular objects', () => {
    const circular: Record<string, unknown> = {
      user: 'quentin',
      password: 'secret-password',
      nested: {
        apiKey: 'sk-live-123',
        authorization: 'Bearer abc',
        token: 'tok-999',
      },
    };
    circular.self = circular;

    const clean = sanitizePayload(circular) as Record<string, unknown>;
    assert.equal(clean.user, 'quentin');
    assert.equal(clean.password, '[REDACTED]');
    assert.equal((clean.nested as Record<string, unknown>).apiKey, '[REDACTED]');
    assert.equal((clean.nested as Record<string, unknown>).authorization, '[REDACTED]');
    assert.equal((clean.nested as Record<string, unknown>).token, '[REDACTED]');
    assert.equal(clean.self, '[Circular]');
  });

  it('truncates oversized strings with ellipsis', () => {
    const longText = 'x'.repeat(200);
    const clean = sanitizePayload({ msg: longText }) as { msg: string };
    assert.equal(clean.msg.length, 121);
    assert.ok(clean.msg.endsWith('…'));
  });

  it('computes causal negative offsets relative to the latest event', () => {
    const timeline = formatRelativeTimeline([
      { id: '1', type: 'click', timestamp: 1000, relativeMs: 0, summary: 'click' },
      { id: '2', type: 'fetch', timestamp: 1450, relativeMs: 0, summary: 'fetch 500' },
      { id: '3', type: 'error', timestamp: 1500, relativeMs: 0, summary: 'crash' },
    ]);

    assert.deepEqual(
      timeline.map((e) => e.relativeMs),
      [-500, -50, 0],
    );
  });
});

describe('Vite Plugin & Standalone Bridge + MCP JSON-RPC Integration', () => {
  it('exposes Vite plugin metadata with apply: serve and enforce: pre', () => {
    const plugin = vitePluginJolt();
    assert.equal(plugin.name, 'vite-plugin-jolt');
    assert.equal(plugin.apply, 'serve');
    assert.equal(plugin.enforce, 'pre');

    plugin.configResolved?.({ root: '/repo' });
    const htmlOut = plugin.transformIndexHtml?.('<body><button>Hi</button></body>', {
      filename: '/repo/index.html',
    });
    assert.ok(htmlOut?.html.includes('data-jolt-loc="index.html:1:7"'));
    assert.equal(htmlOut?.tags[0]?.attrs.src, JOLT_ROUTES.PROBE_SCRIPT);
  });

  it('serves Playground, enforces CSRF token, handles Pins/Mocks, and responds via MCP JSON-RPC', async () => {
    const projectRoot = path.resolve(import.meta.dirname, '..');
    const playgroundDir = path.join(projectRoot, 'playground');
    const tempJoltDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-test-'));

    const server = await startStandaloneDevServer({
      staticDir: playgroundDir,
      rootDir: projectRoot,
      port: 0,
      host: '127.0.0.1',
      jolt: { joltDir: tempJoltDir },
    });

    try {
      // 1. HTML includes injected data-jolt-loc and probe script tag
      const htmlRes = await fetch(`${server.url}/`);
      assert.equal(htmlRes.status, 200);
      const html = await htmlRes.text();
      assert.ok(html.includes(JOLT_ROUTES.PROBE_SCRIPT));
      assert.ok(html.includes('data-jolt-loc="playground/index.html:'));

      // 2. Probe bundle JS is served cleanly
      const probeRes = await fetch(`${server.url}${JOLT_ROUTES.PROBE_SCRIPT}`);
      assert.equal(probeRes.status, 200);
      const probeJs = await probeRes.text();
      assert.ok(probeJs.includes('JoltHudElement'));

      // 3. Real /api/checkout returns 200 OK
      const apiRes = await fetch(`${server.url}/api/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'studio', quantity: 2, total: 98 }),
      });
      assert.equal(apiRes.status, 200);
      const apiData = (await apiRes.json()) as { ok: boolean; total: number };
      assert.equal(apiData.ok, true);
      assert.equal(apiData.total, 98);

      // 4. Report endpoint rejects missing X-Jolt-Token (CSRF guard)
      const unauthRes = await fetch(`${server.url}${JOLT_ROUTES.CLIENT_REPORT}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'pin', data: {} }),
      });
      assert.equal(unauthRes.status, 403);

      // 5. Report endpoint accepts pinned element with valid token AND wakes /__jolt/wait-pin
      const waitPinPromise = fetch(`${server.url}${JOLT_ROUTES.WAIT_PIN}?since=${Date.now()}`);
      await new Promise((r) => setTimeout(r, 15));

      const pinRes = await fetch(`${server.url}${JOLT_ROUTES.CLIENT_REPORT}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Jolt-Token': server.bridge.sessionToken,
        },
        body: JSON.stringify({
          kind: 'pin',
          data: {
            id: 'pin_test_1',
            timestamp: Date.now(),
            note: 'Button misaligned on mobile',
            target: {
              tag: 'button#btn-demo-target',
              loc: 'playground/index.html:100:11',
              rect: { x: 10, y: 20, width: 140, height: 38 },
              styles: { display: 'inline-flex', position: 'relative' },
            },
            parent: {
              tag: 'div.layout-demo-parent',
              rect: { x: 0, y: 10, width: 500, height: 60 },
              styles: { display: 'flex', justifyContent: 'space-between' },
            },
          },
        }),
      });
      assert.equal(pinRes.status, 200);

      const waitPinRes = await waitPinPromise;
      assert.equal(waitPinRes.status, 200);
      const waitPinJson = (await waitPinRes.json()) as { pin?: { id: string; note: string } };
      assert.equal(waitPinJson.pin?.id, 'pin_test_1');
      assert.equal(waitPinJson.pin?.note, 'Button misaligned on mobile');

      // 5b. Status broadcast endpoint accepts working/done updates
      const statusRes = await fetch(`${server.url}${JOLT_ROUTES.STATUS}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'done', message: '✅ Patch applied' }),
      });
      assert.equal(statusRes.status, 200);

      // 5c. File IPC bridge (.jolt/inbox.json, .jolt/digest.json, .jolt/outbox.json)
      const joltDir = tempJoltDir;
      assert.ok(fs.existsSync(path.join(joltDir, 'inbox.json')));
      assert.ok(fs.existsSync(path.join(joltDir, 'digest.json')));
      const inboxParsed = JSON.parse(fs.readFileSync(path.join(joltDir, 'inbox.json'), 'utf8')) as {
        id: string;
        note: string;
      };
      assert.equal(inboxParsed.id, 'pin_test_1');
      assert.equal(inboxParsed.note, 'Button misaligned on mobile');

      fs.writeFileSync(
        path.join(joltDir, 'outbox.json'),
        JSON.stringify({
          id: 'outbox_test_1',
          status: 'done',
          message: 'OK outbox',
          reply: 'Test reply via outbox.json',
          mock: {
            action: 'add',
            urlPattern: '/api/outbox-check',
            status: 418,
          },
        }),
        'utf8',
      );
      await new Promise((r) => setTimeout(r, 200));
      const digestAfterOutbox = server.bridge.getDigest();
      assert.ok(digestAfterOutbox.activeMocks.some((m) => m.urlPattern === '/api/outbox-check' && m.status === 418));
      server.bridge.manageMocks({ action: 'clear' });
      fs.rmSync(path.join(joltDir, 'outbox.json'), { force: true });

      // 6. MCP JSON-RPC initialize & tools/list
      const initReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
      });
      assert.equal((initReply?.result as { serverInfo: { name: string } }).serverInfo.name, 'vite-plugin-jolt');

      const listReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      });
      const tools = (listReply?.result as { tools: Array<{ name: string }> }).tools;
      assert.deepEqual(
        tools.map((t) => t.name),
        ['jolt_get_digest', 'jolt_inspect_element', 'jolt_mutate_runtime', 'jolt_mock_network', 'jolt_spotlight'],
      );

      // 6b. MCP jolt_spotlight broadcasts visual Spotlight payload without requiring file IPC
      const spotReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 6,
        method: 'tools/call',
        params: {
          name: 'jolt_spotlight',
          arguments: {
            port: server.port,
            target: '#btn-checkout',
            variant: 'preview',
            title: 'Spotlight MCP',
            message: 'Confirm this style?',
            previewCss: { color: '#ffffff' },
          },
        },
      });
      const spotText = (spotReply?.result as { content: Array<{ text: string }> }).content[0].text;
      assert.ok(spotText.includes('"ok": true'));
      assert.ok(spotText.includes('spot_'));

      // 7. MCP jolt_mock_network adds a 500 mock rule
      const mockReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'jolt_mock_network',
          arguments: {
            port: server.port,
            action: 'add',
            urlPattern: '/api/checkout',
            method: 'POST',
            status: 500,
            responseBody: { error: 'Simulated 500' },
          },
        },
      });
      const mockText = (mockReply?.result as { content: Array<{ text: string }> }).content[0].text;
      assert.ok(mockText.includes('"/api/checkout"'));

      // 8. MCP jolt_inspect_element returns the pinned Alt+Click element
      const inspectReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 4,
        method: 'tools/call',
        params: {
          name: 'jolt_inspect_element',
          arguments: { port: server.port },
        },
      });
      const inspectText = (inspectReply?.result as { content: Array<{ text: string }> }).content[0].text;
      assert.ok(inspectText.includes('Button misaligned on mobile'));

      // 9. MCP jolt_get_digest returns unified white-box digest
      const digestReply = await handleJsonRpcMessage({
        jsonrpc: '2.0',
        id: 5,
        method: 'tools/call',
        params: {
          name: 'jolt_get_digest',
          arguments: { port: server.port },
        },
      });
      const digestText = (digestReply?.result as { content: Array<{ text: string }> }).content[0].text;
      const digest = JSON.parse(digestText) as {
        healthy: boolean;
        pinnedElements: Array<{ note: string }>;
        activeMocks: Array<{ status: number }>;
      };
      assert.equal(digest.healthy, true);
      assert.equal(digest.pinnedElements[0].note, 'Button misaligned on mobile');
      assert.equal(digest.activeMocks[0].status, 500);
    } finally {
      await server.close();
      fs.rmSync(tempJoltDir, { recursive: true, force: true });
    }
  });
});
