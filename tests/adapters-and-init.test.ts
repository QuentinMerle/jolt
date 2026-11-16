import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  joltPinia,
  joltPiniaStore,
  joltRedux,
  joltThree,
  joltZustand,
} from '../src/adapters/index.ts';
import type { JoltGlobalBridge, JoltStoreRegistration } from '../src/adapters/index.ts';
import { applyJoltProjectSetup } from '../src/mcp/init-setup.ts';
import { JoltBridgeCore } from '../src/server/bridge-core.ts';
import { injectSourceLocations } from '../src/transform/source-locator.ts';

function createMockBridge() {
  const stores = new Map<string, JoltStoreRegistration>();
  let sceneGetter: (() => unknown[]) | null = null;
  const events: Array<{ summary: string; details?: Record<string, unknown> }> = [];

  const bridge: JoltGlobalBridge = {
    registerStore(name, config) {
      stores.set(name, config);
      return () => {
        stores.delete(name);
      };
    },
    registerScene(getter) {
      sceneGetter = getter;
    },
    recordStoreEvent(summary, details) {
      events.push({ summary, details });
    },
  };

  (globalThis as Record<string, unknown>).__JOLT__ = bridge;
  return {
    stores,
    events,
    getSceneNodes: () => (sceneGetter ? sceneGetter() : []),
  };
}

describe('Jolt Game-Changer Adapters (Zustand / Pinia / Redux / Three.js)', () => {
  afterEach(() => {
    delete (globalThis as Record<string, unknown>).__JOLT__;
  });

  it('joltZustand separates state from actions, patches state, logs events, and cleans up', () => {
    const mock = createMockBridge();
    let currentState = {
      count: 2,
      coupon: 'EARLY',
      increment: () => {
        currentState = { ...currentState, count: currentState.count + 1 };
        for (const fn of listeners) fn(currentState, currentState);
      },
    };
    const listeners = new Set<(s: typeof currentState, p: typeof currentState) => void>();
    const useCartStore = {
      getState: () => currentState,
      setState: (partial: Partial<typeof currentState> | ((s: typeof currentState) => Partial<typeof currentState>)) => {
        const patch = typeof partial === 'function' ? partial(currentState) : partial;
        currentState = { ...currentState, ...patch };
      },
      subscribe: (listener: (s: typeof currentState, p: typeof currentState) => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    };

    const cleanup = joltZustand('cart', useCartStore);
    const reg = mock.stores.get('cart');
    assert.ok(reg, 'Zustand store should be registered');
    assert.deepEqual(reg.getState(), { count: 2, coupon: 'EARLY' });
    assert.ok(reg.actions && typeof reg.actions.increment === 'function');

    reg.actions.increment();
    assert.equal(currentState.count, 3);
    assert.equal(mock.events[0]?.summary, 'cart updated');

    reg.setState?.({ coupon: 'VIP' });
    assert.deepEqual(reg.getState(), { count: 3, coupon: 'VIP' });

    cleanup();
    assert.equal(mock.stores.has('cart'), false);
    assert.equal(listeners.size, 0);
  });

  it('joltPinia and joltPiniaStore inspect state, run $patch, and invoke actions', () => {
    const mock = createMockBridge();
    const userStore = {
      $id: 'user',
      $state: { name: 'Alice', role: 'dev' },
      $patch(partial: Partial<{ name: string; role: string }>) {
        Object.assign(this.$state, partial);
      },
      $subscribe(cb: (mutation: { type?: string }, state: { name: string; role: string }) => void) {
        cb({ type: 'patch' }, this.$state);
        return () => {};
      },
      promote(nextRole: unknown) {
        this.$state.role = String(nextRole);
      },
    };

    const pinia = { _s: new Map([[userStore.$id, userStore]]) };
    const cleanupPinia = joltPinia(pinia);

    const reg = mock.stores.get('user');
    assert.ok(reg);
    assert.deepEqual(reg.getState(), { name: 'Alice', role: 'dev' });
    assert.equal(mock.events[0]?.summary, 'user (patch)');

    reg.setState?.({ name: 'Bob' });
    assert.equal(userStore.$state.name, 'Bob');

    reg.actions?.promote('lead');
    assert.equal(userStore.$state.role, 'lead');

    cleanupPinia();
    assert.equal(mock.stores.has('user'), false);

    // Individual store helper
    const stopSingle = joltPiniaStore(userStore, 'customUser');
    assert.ok(mock.stores.has('customUser'));
    stopSingle();
  });

  it('joltRedux wraps action creators and dispatches @@JOLT/PATCH', () => {
    const mock = createMockBridge();
    let state = { items: 1 };
    const dispatched: Array<{ type: string; [k: string]: unknown }> = [];
    const store = {
      getState: () => state,
      dispatch: (action: { type: string; [k: string]: unknown }) => {
        dispatched.push(action);
        if (action.type === 'ADD_ITEM') state = { items: state.items + Number(action.delta || 1) };
        if (action.type === '@@JOLT/PATCH' && action.payload && typeof action.payload === 'object') {
          state = { ...state, ...(action.payload as { items: number }) };
        }
        return action;
      },
      subscribe: () => () => {},
    };

    const cleanup = joltRedux('checkout', store, {
      addItem: (delta: unknown) => ({ type: 'ADD_ITEM', delta }),
    });
    const reg = mock.stores.get('checkout');
    assert.ok(reg);
    reg.actions?.addItem(2);
    assert.deepEqual(reg.getState(), { items: 3 });

    reg.setState?.({ items: 9 });
    assert.deepEqual(reg.getState(), { items: 9 });
    assert.equal(dispatched[1]?.type, '@@JOLT/PATCH');

    cleanup();
    assert.equal(mock.stores.has('checkout'), false);
  });

  it('joltThree auto-projects Three.js scene nodes and mutates position/scale/visible', () => {
    const mock = createMockBridge();
    const identity4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const mesh = {
      uuid: 'mesh-1',
      name: 'HeroTorus',
      type: 'Mesh',
      isMesh: true,
      visible: true,
      position: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
      geometry: { boundingSphere: { radius: 0.5 } },
      material: { color: { getHexString: () => '10b981' } },
      userData: { joltLoc: 'src/Scene.tsx:18:7' },
    };
    const scene = {
      traverse(cb: (o: typeof mesh) => void) {
        cb(mesh);
      },
    };
    const camera = {
      matrixWorldInverse: { elements: identity4 },
      projectionMatrix: { elements: identity4 },
    };

    const cleanup = joltThree(scene, camera, {
      domElement: { getBoundingClientRect: () => ({ left: 0, top: 0, width: 1000, height: 600 }) },
    });

    const nodes = mock.getSceneNodes() as Array<{ id: string; screenRect?: { width: number }; color?: string }>;
    assert.equal(nodes.length, 1);
    assert.equal(nodes[0].id, 'HeroTorus');
    assert.equal(nodes[0].color, '#10b981');
    assert.ok((nodes[0].screenRect?.width ?? 0) > 0, 'Should compute projected 2D screenRect');

    const threeStore = mock.stores.get('joltThreeScene');
    assert.ok(threeStore);
    threeStore.actions?.setNodePosition({ id: 'HeroTorus', position: [1.5, 2.0, -3.0] });
    threeStore.actions?.setNodeScale({ id: 'HeroTorus', scale: 2.2 });
    threeStore.actions?.setNodeVisible({ id: 'HeroTorus', visible: false });
    assert.equal(mesh.position.x, 1.5);
    assert.equal(mesh.scale.x, 2.2);
    assert.equal(mesh.visible, false);

    cleanup();
    assert.equal(mock.stores.has('joltThreeScene'), false);
  });
});

describe('CLI init (--write), Build dist/, Framework Transforms & Listening Handover', () => {
  it('annotates Vue and Svelte SFC markup accurately', () => {
    const vueCode = '<template>\n  <button class="pay">Pay</button>\n</template>';
    const vueOut = injectSourceLocations(vueCode, 'src/Cart.vue', process.cwd());
    assert.ok(vueOut.includes('data-jolt-loc="src/Cart.vue:2:3"'));

    const svelteCode = '<script>let count = 0;</script>\n<div class="card"><span>Hi</span></div>';
    const svelteOut = injectSourceLocations(svelteCode, 'src/Card.svelte', process.cwd());
    assert.ok(svelteOut.includes('data-jolt-loc="src/Card.svelte:2:1"'));
    assert.ok(svelteOut.includes('<script>let count = 0;</script>'));
  });

  it('applyJoltProjectSetup scaffolds AGENTS.md, .mcp.json, and .gitignore idempotently', () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-init-'));
    try {
      fs.writeFileSync(
        path.join(tempDir, '.mcp.json'),
        JSON.stringify({ mcpServers: { existing: { command: 'echo' } } }, null, 2),
      );
      fs.writeFileSync(path.join(tempDir, 'AGENTS.md'), '# Project Rules\nKeep code clean.\n');

      applyJoltProjectSetup(tempDir, '/app/dist/mcp/jolt-mcp-server.js', { write: true });
      applyJoltProjectSetup(tempDir, '/app/dist/mcp/jolt-mcp-server.js', { write: true });

      const agentsText = fs.readFileSync(path.join(tempDir, 'AGENTS.md'), 'utf8');
      assert.ok(agentsText.includes('# Project Rules'));
      assert.equal(agentsText.match(/<!-- JOLT:START -->/g)?.length, 1);
      assert.ok(agentsText.includes('[STOP_LIVE]'));

      const mcpParsed = JSON.parse(fs.readFileSync(path.join(tempDir, '.mcp.json'), 'utf8')) as {
        mcpServers: Record<string, { command: string }>;
      };
      assert.ok(mcpParsed.mcpServers.existing);
      assert.equal(mcpParsed.mcpServers.jolt.command, 'npx');

      const gitignore = fs.readFileSync(path.join(tempDir, '.gitignore'), 'utf8');
      assert.ok(gitignore.includes('.jolt/'));
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('supports listening -> [STOP_LIVE] handover in JoltBridgeCore & runs built dist CLI', () => {
    const tempJoltDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-listen-'));
    const tempCliDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-dist-cli-'));
    const bridge = new JoltBridgeCore(process.cwd(), { joltDir: tempJoltDir });
    try {
      const distCli = path.resolve(import.meta.dirname, '..', 'dist', 'mcp', 'jolt-mcp-server.js');
      assert.ok(fs.existsSync(distCli), 'dist/mcp/jolt-mcp-server.js should exist (run npm run build)');

      const out = execFileSync(process.execPath, [distCli, 'init', '--write', '--dir', tempCliDir], {
        encoding: 'utf8',
      });
      assert.ok(out.includes('AGENTS.md'));
      assert.ok(fs.existsSync(path.join(tempCliDir, '.mcp.json')));

      // Also verify symlink invocation (mirrors npm `node_modules/.bin/jolt-mcp`)
      const symlinkDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-bin-symlink-'));
      const symlinkBin = path.join(symlinkDir, 'jolt-mcp');
      fs.symlinkSync(distCli, symlinkBin);
      const symTargetDir = path.join(symlinkDir, 'app');
      try {
        const symOut = execFileSync(symlinkBin, ['init', '--write', '--dir', symTargetDir], {
          encoding: 'utf8',
        });
        assert.ok(symOut.includes('AGENTS.md'));
        assert.ok(fs.existsSync(path.join(symTargetDir, '.mcp.json')));
        assert.ok(fs.existsSync(path.join(symTargetDir, 'AGENTS.md')));
      } finally {
        fs.rmSync(symlinkDir, { recursive: true, force: true });
      }

      // Verify viewport field in bridge digest
      const digest = bridge.getDigest();
      assert.equal(digest.healthy, true);
    } finally {
      bridge.unregisterSession();
      fs.rmSync(tempJoltDir, { recursive: true, force: true });
      fs.rmSync(tempCliDir, { recursive: true, force: true });
    }
  });

  it('dist CLI `listen` emits status:listening on start and exits cleanly on [STOP_LIVE]', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jolt-wait-'));
    const inboxPath = path.join(tempDir, 'inbox.json');
    const outboxPath = path.join(tempDir, 'outbox.json');
    const distCli = path.resolve(import.meta.dirname, '..', 'dist', 'mcp', 'jolt-mcp-server.js');

    try {
      const child = spawn(process.execPath, [distCli, 'listen', '--inbox', inboxPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString('utf8');
      });

      // Wait until outbox.json enters listening state
      for (let i = 0; i < 40; i++) {
        if (fs.existsSync(outboxPath)) {
          const outbox = JSON.parse(fs.readFileSync(outboxPath, 'utf8')) as { status?: string };
          if (outbox.status === 'listening') break;
        }
        await new Promise((r) => setTimeout(r, 35));
      }
      const initialOutbox = JSON.parse(fs.readFileSync(outboxPath, 'utf8')) as { status: string };
      assert.equal(initialOutbox.status, 'listening');

      // Send [STOP_LIVE] pin -> listener should exit 0 and release orb to done
      fs.writeFileSync(
        inboxPath,
        JSON.stringify({ id: 'stop_test_1', timestamp: Date.now() + 100, note: '[STOP_LIVE]' }),
      );

      const exitCode = await new Promise<number | null>((resolve) => {
        child.on('exit', resolve);
      });
      assert.equal(exitCode, 0);

      const parsedOut = JSON.parse(stdout) as { note?: string; stoppedByUser?: boolean };
      assert.equal(parsedOut.note, '[STOP_LIVE]');
      assert.equal(parsedOut.stoppedByUser, true);

      const finalOutbox = JSON.parse(fs.readFileSync(outboxPath, 'utf8')) as { status: string };
      assert.equal(finalOutbox.status, 'done');
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
