import { JOLT_ROUTES } from '../shared/constants.ts';
import type { JoltPluginOptions } from '../shared/types.ts';
import { buildDomInspectorScript } from './dom-inspector.ts';
import { buildFlightRecorderScript } from './flight-recorder.ts';
import { buildJoltHudScript } from './jolt-hud.ts';
import { buildNetworkInterceptorScript } from './network-interceptor.ts';
import { buildWebGLProbeScript } from './webgl-probe.ts';

/**
 * Assembles the self-contained browser probe script served at /@jolt/probe.js.
 * Wires SSE push commands (Pull-on-Demand digest, live inspection, mutations, mocks)
 * and exposes `window.__JOLT__` for stores & 3D scene registration.
 */
export function buildProbeBundle(sessionToken: string, options: JoltPluginOptions = {}): string {
  const tokenLiteral = JSON.stringify(sessionToken);
  const webglEnabled = options.webgl !== false;
  const pick3DEnabled = typeof options.webgl === 'object' ? options.webgl.pick3D !== false : webglEnabled;
  const mocksEnabled = options.networkMocks !== false;

  return `// Jolt ⚡ White-Box Browser Probe (Dev-Time Only)
(function JoltClientProbe() {
  if (window.__JOLT_INITIALIZED__) return;
  window.__JOLT_INITIALIZED__ = true;

  const JOLT_TOKEN = ${tokenLiteral};
  const registeredStores = new Map();
  let bgReportTimer = null;

  ${buildFlightRecorderScript()}
  ${buildDomInspectorScript()}
  ${buildNetworkInterceptorScript(mocksEnabled)}
  ${buildWebGLProbeScript({ enabled: webglEnabled, pick3D: pick3DEnabled })}
  ${buildJoltHudScript()}

  function readStoresSnapshot() {
    const out = {};
    for (const [name, entry] of registeredStores.entries()) {
      try {
        out[name] = {
          state: typeof entry.getState === 'function' ? entry.getState() : entry.state,
          actions: Object.keys(entry.actions || {}),
        };
      } catch (err) {
        out[name] = { error: err instanceof Error ? err.message : String(err) };
      }
    }
    return out;
  }

  function buildDigestPayload(includeA11y = true) {
    return {
      timestamp: Date.now(),
      url: window.location.pathname + window.location.search,
      flightRecorder: getFlightTimeline(),
      stores: readStoresSnapshot(),
      webgl: getWebGLSnapshot(),
      viewport: getViewportMetrics(),
      activeMocks: getNetworkMocks(),
      a11yTree: includeA11y ? extractCompactA11y() : [],
    };
  }

  async function postReport(body) {
    try {
      await origFetch('${JOLT_ROUTES.CLIENT_REPORT}', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Jolt-Token': JOLT_TOKEN,
        },
        body: JSON.stringify(body),
      });
    } catch {
      // Ignore transient network errors when dev server restarts.
    }
  }

  function scheduleBackgroundReport(reason) {
    if (bgReportTimer) return;
    bgReportTimer = setTimeout(() => {
      bgReportTimer = null;
      postReport({ kind: 'digest', reason, data: buildDigestPayload(false) });
    }, 30);
  }

  async function submitPinnedElement(pinned) {
    await postReport({ kind: 'pin', data: pinned });
  }

  function executeRuntimeMutation(cmd) {
    if (!cmd || !cmd.operation) return { ok: false, error: 'Missing operation' };

    if (cmd.operation === 'store_action') {
      const store = registeredStores.get(cmd.target);
      if (!store || !store.actions || typeof store.actions[cmd.action] !== 'function') {
        return { ok: false, error: 'Store action not found: ' + cmd.target + '.' + cmd.action };
      }
      const res = store.actions[cmd.action](cmd.payload);
      pushFlightEvent('store', cmd.target + '.' + cmd.action + '()', undefined, { payload: cmd.payload });
      notifyHudUpdate();
      return { ok: true, result: res };
    }

    if (cmd.operation === 'store_set') {
      const store = registeredStores.get(cmd.target);
      if (!store || typeof store.setState !== 'function') {
        return { ok: false, error: 'Store setState not supported: ' + cmd.target };
      }
      store.setState(cmd.payload);
      pushFlightEvent('store', cmd.target + '.setState()', undefined, { payload: cmd.payload });
      notifyHudUpdate();
      return { ok: true };
    }

    if (cmd.operation === 'click_element') {
      const el = resolveElementByQuery({ selector: cmd.target, loc: cmd.target });
      if (!el) return { ok: false, error: 'Element not found: ' + cmd.target };
      if (document.activeElement === el && el instanceof HTMLInputElement) {
        return { ok: false, error: 'Element is locked by human focus' };
      }
      el.click();
      return { ok: true };
    }

    if (cmd.operation === 'clear_storage') {
      localStorage.clear();
      sessionStorage.clear();
      return { ok: true };
    }

    return { ok: false, error: 'Unknown operation: ' + cmd.operation };
  }

  // Pull-on-Demand SSE channel from dev server -> browser
  const evtSource = new EventSource('${JOLT_ROUTES.EVENTS}');
  let lastReplyToast = '';
  let lastReplyAt = 0;

  evtSource.addEventListener('jolt-command', async (rawEvent) => {
    let cmd;
    try {
      cmd = JSON.parse(rawEvent.data);
    } catch {
      return;
    }

    if (cmd.type === 'request-digest') {
      await postReport({
        kind: 'pull-response',
        requestId: cmd.requestId,
        data: buildDigestPayload(cmd.includeA11y !== false),
      });
    } else if (cmd.type === 'inspect-element') {
      const el = resolveElementByQuery({ selector: cmd.selector, loc: cmd.loc });
      const radio = el ? inspectElementRadio(el, 'MCP inspection') : null;
      await postReport({
        kind: 'pull-response',
        requestId: cmd.requestId,
        data: radio,
      });
    } else if (cmd.type === 'mutate-runtime') {
      const outcome = executeRuntimeMutation(cmd.mutation);
      setTimeout(async () => {
        await postReport({
          kind: 'pull-response',
          requestId: cmd.requestId,
          data: { outcome, digest: buildDigestPayload(true) },
        });
      }, 60);
    } else if (cmd.type === 'sync-mocks') {
      setNetworkMocks(cmd.mocks);
    } else if (cmd.type === 'agent-status') {
      setHudAgentStatus(cmd.status, cmd.message);
    } else if (cmd.type === 'agent-reply') {
      if (cmd.status !== 'working' && cmd.status !== 'listening' && (cmd.message || cmd.reply)) {
        lastReplyToast = cmd.message || cmd.reply;
        lastReplyAt = Date.now();
      }
      handleHudAgentReply(cmd);
      setTimeout(() => {
        postReport({ kind: 'digest', reason: 'after-reply', data: buildDigestPayload(true) });
      }, 80);
    } else if (cmd.type === 'hmr-update') {
      if (cmd.kind === 'css') {
        const links = document.querySelectorAll('link[rel="stylesheet"]');
        const stamp = String(Date.now());
        links.forEach((link) => {
          if (link instanceof HTMLLinkElement && link.href) {
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('jolt_hmr', stamp);
            link.href = url.toString();
          }
        });
        const msg = (lastReplyToast && Date.now() - lastReplyAt < 6000)
          ? lastReplyToast
          : ('⚡ CSS Hot-Reload : ' + (cmd.file || 'styles.css'));
        setHudAgentStatus('done', msg);
      } else if (cmd.kind === 'reload') {
        try {
          const msg = (lastReplyToast && Date.now() - lastReplyAt < 8000)
            ? lastReplyToast
            : ('⚡ Reload : ' + (cmd.file || 'page'));
          sessionStorage.setItem('__jolt_hmr_toast', msg);
        } catch {}
        window.location.reload();
      }
    }
  });

  // Public dev-time registration API for stores & 3D scene graphs
  window.__JOLT__ = {
    registerStore(name, config) {
      registeredStores.set(name, config);
      notifyHudUpdate();
      return () => {
        registeredStores.delete(name);
        notifyHudUpdate();
      };
    },
    registerScene(getter) {
      webglState.sceneGetter = getter;
      notifyHudUpdate();
    },
    setMocks(rules) {
      setNetworkMocks(rules);
      postReport({ kind: 'mocks-sync', data: rules });
    },
    triggerDigest() {
      const digest = buildDigestPayload(true);
      postReport({ kind: 'digest', reason: 'manual', data: digest });
      return digest;
    },
    recordStoreEvent(summary, details) {
      pushFlightEvent('store', summary, undefined, details);
    },
    exportReproTest() {
      const events = getFlightTimeline();
      const mocks = getNetworkMocks().filter((m) => m.active !== false);
      const lines = [
        "import { describe, it, expect } from 'vitest';",
        '',
        "describe('Jolt Flight Recorder Repro', () => {",
        "  it('reproduces captured runtime sequence', async () => {",
      ];
      for (let i = 0; i < mocks.length; i++) {
        const m = mocks[i];
        lines.push('    // Active mock: ' + (m.method || 'ANY') + ' ' + m.urlPattern + ' -> HTTP ' + m.status);
      }
      for (let i = 0; i < events.length; i++) {
        const ev = events[i];
        lines.push('    // ' + ev.relativeMs + 'ms [' + ev.type + '] ' + ev.summary);
      }
      lines.push("    expect(true).toBe(true);");
      lines.push('  });');
      lines.push('});');
      return lines.join('\\n');
    },
    showSpotlight(spec) {
      handleHudAgentReply({ status: 'done', message: spec && spec.title ? spec.title : 'Agent Spotlight', spotlight: spec });
    },
    configure(next) {
      if (!next || typeof next !== 'object') return;
      if (typeof next.webgl === 'boolean') configureWebGLProbe({ enabled: next.webgl, pick3D: next.webgl });
      else if (next.webgl && typeof next.webgl === 'object') configureWebGLProbe({ pick3D: next.webgl.pick3D });
      if (typeof next.pick3D === 'boolean') configureWebGLProbe({ pick3D: next.pick3D });
      notifyHudUpdate();
    },
  };

  mountJoltHud();
  setTimeout(() => postReport({ kind: 'digest', reason: 'boot', data: buildDigestPayload(true) }), 150);
})();
`;
}
