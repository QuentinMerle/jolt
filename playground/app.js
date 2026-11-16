// Lightweight static-hosting fallback when playground runs without Jolt's Node server
if (!window.__JOLT__) {
  const staticStores = new Map();
  let staticMocks = [];
  let staticSceneGetter = null;
  let staticSpotlightRestore = null;

  const nativeFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof Request ? input.url : String(input);
    const method = ((init && init.method) || (input instanceof Request ? input.method : 'GET')).toUpperCase();
    if (url.includes('/api/checkout') && method === 'POST') {
      const mock = staticMocks.find((m) => m.active !== false && url.includes(m.urlPattern));
      if (mock) {
        return new Response(JSON.stringify(mock.responseBody), {
          status: mock.status || 500,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      let bodyObj = {};
      try {
        bodyObj = init && typeof init.body === 'string' ? JSON.parse(init.body) : {};
      } catch {}
      return new Response(
        JSON.stringify({ ok: true, orderId: 'ORD-DEMO200', total: bodyObj.total ?? 38 }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return nativeFetch(input, init);
  };

  function closeStaticSpotlight(restore) {
    document.querySelectorAll('.jolt-static-backdrop, .jolt-static-card').forEach((n) => n.remove());
    if (restore && typeof staticSpotlightRestore === 'function') {
      staticSpotlightRestore();
    }
    staticSpotlightRestore = null;
  }

  window.__JOLT__ = {
    _isStaticDemo: true,
    registerStore(name, config) {
      staticStores.set(name, config);
      return () => staticStores.delete(name);
    },
    registerScene(getter) {
      staticSceneGetter = getter;
    },
    setMocks(rules) {
      staticMocks = Array.isArray(rules) ? rules : [];
    },
    recordStoreEvent() {},
    triggerDigest() {
      const storeOut = {};
      for (const [k, v] of staticStores.entries()) {
        storeOut[k] = { state: typeof v.getState === 'function' ? v.getState() : {}, actions: Object.keys(v.actions || {}) };
      }
      return {
        timestamp: Date.now(),
        url: window.location.pathname,
        healthy: true,
        stores: storeOut,
        activeMocks: staticMocks,
        webgl: staticSceneGetter ? { active: true, fps: 60, sceneNodes: staticSceneGetter() } : null,
      };
    },
    showSpotlight(spec) {
      if (!spec || typeof spec !== 'object') return;
      closeStaticSpotlight(true);
      const targetEl = spec.target ? document.querySelector(spec.target) : null;
      if (targetEl && spec.previewCss) {
        const saved = [];
        for (const [prop, val] of Object.entries(spec.previewCss)) {
          const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
          saved.push([cssProp, targetEl.style.getPropertyValue(cssProp)]);
          targetEl.style.setProperty(cssProp, String(val));
        }
        staticSpotlightRestore = () => {
          for (const [p, oldVal] of saved) {
            if (oldVal) targetEl.style.setProperty(p, oldVal);
            else targetEl.style.removeProperty(p);
          }
        };
      }
      const backdrop = document.createElement('div');
      backdrop.className = 'jolt-static-backdrop';
      backdrop.addEventListener('click', () => closeStaticSpotlight(true));

      const card = document.createElement('div');
      card.className = 'jolt-static-card';
      const rect = targetEl ? targetEl.getBoundingClientRect() : { left: window.innerWidth - 360, top: 120 };
      card.style.left = `${Math.max(12, Math.min(window.innerWidth - 356, rect.left))}px`;
      card.style.top = `${Math.max(12, Math.min(window.innerHeight - 190, rect.top > 180 ? rect.top - 150 : rect.top + 52))}px`;

      const badge = document.createElement('span');
      badge.className = 'jolt-static-badge';
      badge.textContent = spec.variant === 'preview' ? 'CSS PREVIEW' : 'AGENT QUESTION';
      const title = document.createElement('strong');
      title.textContent = spec.title || 'Jolt Spotlight';
      const msg = document.createElement('p');
      msg.style.margin = '0';
      msg.textContent = spec.message || '';

      const actions = document.createElement('div');
      actions.className = 'jolt-static-actions';
      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'btn btn-secondary';
      cancelBtn.textContent = spec.cancelLabel || '✕ Close';
      cancelBtn.addEventListener('click', () => closeStaticSpotlight(true));

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'btn btn-primary';
      confirmBtn.textContent = spec.confirmLabel || '✓ Confirm';
      confirmBtn.addEventListener('click', () => closeStaticSpotlight(spec.keepPreviewOnConfirm === false));

      actions.append(cancelBtn, confirmBtn);
      card.append(badge, title, msg, actions);
      document.body.append(backdrop, card);
    },
  };
}

import { initWebGLScene, createDefaultSceneNodes } from './webgl-scene.js';

const PLAN_PRICES = { indie: 19, studio: 49, blue: 99 };

const state = {
  plan: 'indie',
  quantity: 2,
  rotationSpeed: 1.1,
  palette: 'multi',
  paletteOverride: false,
  wireframe: false,
  mock500Active: false,
  lastOrder: null,
  sceneNodes: createDefaultSceneNodes(),
};

const els = {
  speedInput: document.getElementById('ctrl-speed'),
  speedOut: document.getElementById('out-speed'),
  paletteSelect: document.getElementById('ctrl-palette'),
  wireframeCheck: document.getElementById('ctrl-wireframe'),
  planBtns: document.querySelectorAll('.plan-btn'),
  qtyMinus: document.getElementById('btn-qty-minus'),
  qtyPlus: document.getElementById('btn-qty-plus'),
  qtyValue: document.getElementById('qty-value'),
  totalPrice: document.getElementById('total-price'),
  checkoutBtn: document.getElementById('btn-checkout'),
  toggleMockBtn: document.getElementById('btn-toggle-mock'),
  mockBadge: document.getElementById('mock-badge'),
  crashBtn: document.getElementById('btn-crash'),
  networkStatus: document.getElementById('network-status'),
  fetchDigestBtn: document.getElementById('btn-fetch-digest'),
  demoTargetBtn: document.getElementById('btn-demo-target'),
  demoSpotlightBtn: document.getElementById('btn-demo-spotlight'),
  demoLoopBtn: document.getElementById('btn-demo-loop'),
  demoTargetLog: document.getElementById('demo-target-log'),
  digestPreview: document.getElementById('digest-preview'),
  installTabs: document.querySelectorAll('[data-install-tab]'),
  installCode: document.getElementById('install-code'),
  copyInstallBtn: document.getElementById('btn-copy-install'),
  adapterTabs: document.querySelectorAll('[data-adapter-tab]'),
  adapterCode: document.getElementById('adapter-code'),
  copyCliBtn: document.getElementById('btn-copy-cli'),
  canvas: document.getElementById('jolt-webgl-canvas'),
  chaosDiagram: document.getElementById('chaos-diagram'),
  chaosMidLabel: document.getElementById('chaos-mid-label'),
  chaosEndLabel: document.getElementById('chaos-end-label'),
  chaosTl1Time: document.getElementById('chaos-tl-1-time'),
  chaosTl1Evt: document.getElementById('chaos-tl-1-evt'),
  chaosTl2Time: document.getElementById('chaos-tl-2-time'),
  chaosTl2Evt: document.getElementById('chaos-tl-2-evt'),
  chaosTl3: document.getElementById('chaos-tl-3'),
};

function updateChaosDiagram(mode, detail = {}) {
  if (!els.chaosDiagram) return;
  els.chaosDiagram.dataset.mode = mode;

  const presets = {
    nominal: {
      mid: 'LIVE 200',
      end: 'NOMINAL',
      t1Time: 'T-0ms',
      t1Evt: ' [standby]',
      t2Time: 'route',
      t2Evt: ' [/checkout]',
      t2Color: '#6ee7b7',
      t3: '[HTTP 200 ready]',
      t3Color: '#6ee7b7',
    },
    'mock-armed': {
      mid: 'MOCK 500',
      end: 'ARMED',
      t1Time: 'T-0ms',
      t1Evt: ' [mock armed]',
      t2Time: 'mock',
      t2Evt: ' [/checkout]',
      t2Color: '#fbbf24',
      t3: '[ready → 500]',
      t3Color: '#fcd34d',
    },
    'fault-500': {
      mid: 'MOCK 500',
      end: 'FAULT 500',
      t1Time: 'T-840ms',
      t1Evt: ' [click]',
      t2Time: 'T-12ms',
      t2Evt: ' [fetch 500]',
      t2Color: '#fbbf24',
      t3: '[checkout error]',
      t3Color: '#fda4af',
    },
    'crash-js': {
      mid: 'RUNTIME',
      end: 'CRASH JS',
      t1Time: 'T-10ms',
      t1Evt: ' [click]',
      t2Time: 'T-0ms',
      t2Evt: ' [throw Error]',
      t2Color: '#fda4af',
      t3: '[uncaught fault]',
      t3Color: '#fda4af',
    },
  };

  const cfg = { ...presets[mode], ...detail };
  if (els.chaosMidLabel) els.chaosMidLabel.textContent = cfg.mid;
  if (els.chaosEndLabel) els.chaosEndLabel.textContent = cfg.end;
  if (els.chaosTl1Time) els.chaosTl1Time.textContent = cfg.t1Time;
  if (els.chaosTl1Evt) els.chaosTl1Evt.textContent = cfg.t1Evt;
  if (els.chaosTl2Time) els.chaosTl2Time.textContent = cfg.t2Time;
  if (els.chaosTl2Evt) {
    els.chaosTl2Evt.textContent = cfg.t2Evt;
    els.chaosTl2Evt.setAttribute('fill', cfg.t2Color);
  }
  if (els.chaosTl3) {
    els.chaosTl3.textContent = cfg.t3;
    els.chaosTl3.setAttribute('fill', cfg.t3Color);
  }
}

function computeTotal() {
  return (PLAN_PRICES[state.plan] || 19) * state.quantity;
}

function syncUI() {
  els.speedInput.value = String(state.rotationSpeed);
  els.speedOut.textContent = `${state.rotationSpeed.toFixed(1)}×`;
  els.paletteSelect.value = state.palette;
  els.wireframeCheck.checked = state.wireframe;
  els.qtyValue.textContent = String(state.quantity);
  els.totalPrice.textContent = `$${computeTotal()}`;

  els.planBtns.forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.plan === state.plan);
  });

  els.mockBadge.textContent = state.mock500Active ? 'Mock 500 active' : 'Live network';
  els.mockBadge.dataset.state = state.mock500Active ? 'mock' : 'live';
  els.toggleMockBtn.textContent = state.mock500Active
    ? 'Disable Mock 500'
    : 'Enable Mock HTTP 500';
}

async function runCheckoutRequest() {
  els.networkStatus.dataset.state = '';
  els.networkStatus.textContent = 'Sending POST /api/checkout…';

  try {
    const res = await fetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan: state.plan,
        quantity: state.quantity,
        total: computeTotal(),
      }),
    });
    const data = await res.json();

    if (!res.ok) {
      els.networkStatus.dataset.state = 'error';
      els.networkStatus.textContent = `HTTP ${res.status} — ${JSON.stringify(data)}`;
      updateChaosDiagram('fault-500');
      state.lastOrder = { ok: false, status: res.status, data };
      return state.lastOrder;
    }

    els.networkStatus.dataset.state = 'ok';
    els.networkStatus.textContent = `HTTP ${res.status} OK — Order ${data.orderId} ($${data.total})`;
    updateChaosDiagram('nominal', {
      t1Time: 'T-42ms',
      t1Evt: ' [click]',
      t2Time: 'T-8ms',
      t2Evt: ` [HTTP ${res.status}]`,
      t3: `[${data.orderId} ok]`,
    });
    state.lastOrder = { ok: true, status: res.status, data };
    return state.lastOrder;
  } catch (err) {
    els.networkStatus.dataset.state = 'error';
    els.networkStatus.textContent = `Network error: ${err instanceof Error ? err.message : String(err)}`;
    updateChaosDiagram('crash-js', {
      end: 'NET ERR',
      t2Evt: ' [fetch fail]',
      t3: '[network error]',
    });
    state.lastOrder = { ok: false, error: String(err) };
    return state.lastOrder;
  }
}

function applyMock500(enable) {
  state.mock500Active = enable;
  if (window.__JOLT__) {
    if (enable) {
      window.__JOLT__.setMocks([
        {
          id: 'playground-mock-500',
          urlPattern: '/api/checkout',
          method: 'POST',
          status: 500,
          responseBody: { error: 'Out of stock (simulated by Jolt)' },
          active: true,
          hitCount: 0,
        },
      ]);
    } else {
      window.__JOLT__.setMocks([]);
    }
  }
  if (enable) {
    els.networkStatus.dataset.state = 'warn';
    els.networkStatus.textContent =
      'Mock HTTP 500 armed on POST /api/checkout — click “Confirm & Pay” to experience the fault live.';
    updateChaosDiagram('mock-armed');
  } else {
    els.networkStatus.dataset.state = '';
    els.networkStatus.textContent = 'Mock 500 disabled — back to live network (HTTP 200).';
    updateChaosDiagram('nominal');
  }
  syncUI();
}

function updateSceneNode(patch) {
  if (!patch || typeof patch !== 'object') return { ok: false, error: 'Missing patch' };
  const key = patch.id || patch.target || patch.name;
  const node = state.sceneNodes.find((n) => n.id === key || n.name === key);
  if (!node) return { ok: false, error: `Scene node not found: ${key}` };

  if (Array.isArray(patch.position) && patch.position.length >= 3) {
    node.position = [Number(patch.position[0]), Number(patch.position[1]), Number(patch.position[2])];
  } else {
    if (typeof patch.x === 'number') node.position[0] = patch.x;
    if (typeof patch.y === 'number') node.position[1] = patch.y;
    if (typeof patch.z === 'number') node.position[2] = patch.z;
    if (typeof patch.dx === 'number') node.position[0] += patch.dx;
    if (typeof patch.dy === 'number') node.position[1] += patch.dy;
    if (typeof patch.dz === 'number') node.position[2] += patch.dz;
  }

  if (typeof patch.scale === 'number') node.scale = patch.scale;
  if (typeof patch.tiltX === 'number') node.tiltX = patch.tiltX;
  if (typeof patch.spinX === 'number') node.spinX = patch.spinX;
  if (typeof patch.spinY === 'number') node.spinY = patch.spinY;
  if (typeof patch.colorKey === 'string') node.colorKey = patch.colorKey;
  else if (typeof patch.color === 'string') node.colorKey = patch.color;
  if (typeof patch.visible === 'boolean') node.visible = patch.visible;

  if (window.__JOLT__ && typeof window.__JOLT__.recordStoreEvent === 'function') {
    window.__JOLT__.recordStoreEvent(`updateSceneNode(${node.id})`, { position: [...node.position] });
  }
  syncUI();
  return { ok: true, id: node.id, position: [...node.position] };
}

// Register reactive store inside Jolt White-Box Bridge
if (window.__JOLT__) {
  window.__JOLT__.registerStore('joltLabStore', {
    getState: () => ({
      plan: state.plan,
      quantity: state.quantity,
      total: computeTotal(),
      rotationSpeed: state.rotationSpeed,
      palette: state.palette,
      wireframe: state.wireframe,
      mock500Active: state.mock500Active,
      lastOrder: state.lastOrder,
      sceneNodes: state.sceneNodes.map((n) => ({
        id: n.id,
        name: n.name,
        position: [...n.position],
        scale: n.scale,
        colorKey: n.colorKey,
      })),
    }),
    setState: (partial) => {
      if (partial && typeof partial === 'object') {
        Object.assign(state, partial);
        syncUI();
      }
    },
    actions: {
      setPlan: (plan) => {
        if (typeof plan === 'string' && Object.hasOwn(PLAN_PRICES, plan)) {
          state.plan = plan;
          syncUI();
        }
      },
      setQuantity: (qty) => {
        state.quantity = Math.max(1, Number(qty) || 1);
        syncUI();
      },
      setRotationSpeed: (speed) => {
        state.rotationSpeed = Math.max(0, Math.min(3, Number(speed) || 0));
        syncUI();
      },
      triggerCheckout: () => runCheckoutRequest(),
      toggleMock500: (on) => applyMock500(typeof on === 'boolean' ? on : !state.mock500Active),
      updateSceneNode: (patch) => updateSceneNode(patch),
    },
  });
}

// Wire DOM events
els.speedInput.addEventListener('input', () => {
  state.rotationSpeed = Number(els.speedInput.value);
  syncUI();
});

els.paletteSelect.addEventListener('change', () => {
  state.palette = els.paletteSelect.value;
  state.paletteOverride = state.palette !== 'multi';
  syncUI();
});

els.wireframeCheck.addEventListener('change', () => {
  state.wireframe = els.wireframeCheck.checked;
  syncUI();
});

els.planBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    state.plan = btn.dataset.plan || 'indie';
    syncUI();
  });
});

els.qtyMinus.addEventListener('click', () => {
  state.quantity = Math.max(1, state.quantity - 1);
  syncUI();
});

els.qtyPlus.addEventListener('click', () => {
  state.quantity += 1;
  syncUI();
});

els.checkoutBtn.addEventListener('click', () => {
  runCheckoutRequest();
});

els.toggleMockBtn.addEventListener('click', () => {
  applyMock500(!state.mock500Active);
});

els.crashBtn.addEventListener('click', () => {
  els.networkStatus.dataset.state = 'error';
  els.networkStatus.textContent =
    'Uncaught Error: Simulated crash from Jolt Lab — captured by Flight Recorder & HUD.';
  updateChaosDiagram('crash-js');
  setTimeout(() => {
    throw new Error('Simulated crash from Jolt Lab (Flight Recorder test)');
  }, 10);
});

const SAMPLE_DIGEST_PREVIEW = {
  healthy: true,
  url: '/',
  pinnedElements: [
    {
      loc: 'playground/index.html:193:13',
      tag: 'button#btn-demo-target',
      note: 'Button spacing on mobile',
    },
  ],
  webgl: {
    fps: 120,
    drawCalls: 3,
    sceneNodes: ['CryoOctahedron', 'OrbitalTorus', 'SolarPrism'],
  },
  flightRecorder: [
    'T-840ms [click] button#btn-checkout',
    'T-12ms [fetch 500] POST /api/checkout',
  ],
};

function renderHighlightedJson(preEl, value) {
  if (!preEl) return;
  const raw = JSON.stringify(value, null, 2);
  const frag = document.createDocumentFragment();
  const tokenRegex =
    /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|[{}\[\],:]/g;
  let lastIndex = 0;

  for (const match of raw.matchAll(tokenRegex)) {
    const idx = match.index ?? 0;
    if (idx > lastIndex) {
      frag.appendChild(document.createTextNode(raw.slice(lastIndex, idx)));
    }
    const [full, strToken, colonSuffix, keywordToken] = match;
    let cls = 'tok-num';
    if (strToken) {
      if (colonSuffix) {
        const keySpan = document.createElement('span');
        keySpan.className = 'tok-key';
        keySpan.textContent = strToken;
        frag.appendChild(keySpan);
        const puncSpan = document.createElement('span');
        puncSpan.className = 'tok-punc';
        puncSpan.textContent = colonSuffix;
        frag.appendChild(puncSpan);
        lastIndex = idx + full.length;
        continue;
      }
      cls = 'tok-str';
    } else if (keywordToken === 'true' || keywordToken === 'false') {
      cls = 'tok-bool';
    } else if (keywordToken === 'null') {
      cls = 'tok-null';
    } else if (full.length === 1 && '{}[],:'.includes(full)) {
      cls = 'tok-punc';
    }

    const span = document.createElement('span');
    span.className = cls;
    span.textContent = full;
    frag.appendChild(span);
    lastIndex = idx + full.length;
  }

  if (lastIndex < raw.length) {
    frag.appendChild(document.createTextNode(raw.slice(lastIndex)));
  }
  preEl.replaceChildren(frag);
}

els.fetchDigestBtn.addEventListener('click', async () => {
  if (window.__JOLT__ && window.__JOLT__._isStaticDemo) {
    renderHighlightedJson(els.digestPreview, window.__JOLT__.triggerDigest());
    return;
  }
  els.digestPreview.textContent = 'Querying /__jolt/digest…';
  try {
    const res = await fetch('/__jolt/digest');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const digest = await res.json();
    renderHighlightedJson(els.digestPreview, digest);
  } catch {
    const fallback = window.__JOLT__ && typeof window.__JOLT__.triggerDigest === 'function'
      ? window.__JOLT__.triggerDigest()
      : SAMPLE_DIGEST_PREVIEW;
    renderHighlightedJson(els.digestPreview, fallback);
  }
});

// Hero Install & Adapters syntax-highlighted snippets (safe DOM tokens, zero innerHTML)
const CODE_SNIPPETS = {
  install: {
    vite: {
      raw: "import { vitePluginJolt } from 'vite-plugin-jolt';\nexport default { plugins: [vitePluginJolt()] };",
      tokens: [
        ['kw', 'import'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['fn', 'vitePluginJolt'], ['plain', ' '], ['punc', '}'], ['plain', ' '], ['kw', 'from'], ['plain', ' '], ['str', "'vite-plugin-jolt'"], ['punc', ';'], ['plain', '\n'],
        ['kw', 'export default'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['key', 'plugins'], ['punc', ':'], ['plain', ' '], ['punc', '['], ['fn', 'vitePluginJolt'], ['punc', '()]'], ['plain', ' '], ['punc', '};'],
      ],
    },
    mcp: {
      raw: '{\n  "mcpServers": {\n    "jolt": { "command": "npx", "args": ["-y", "jolt-mcp"] }\n  }\n}',
      tokens: [
        ['punc', '{'], ['plain', '\n  '], ['key', '"mcpServers"'], ['punc', ':'], ['plain', ' '], ['punc', '{'], ['plain', '\n    '],
        ['key', '"jolt"'], ['punc', ':'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['key', '"command"'], ['punc', ':'], ['plain', ' '], ['str', '"npx"'], ['punc', ','], ['plain', ' '],
        ['key', '"args"'], ['punc', ':'], ['plain', ' '], ['punc', '['], ['str', '"-y"'], ['punc', ','], ['plain', ' '], ['str', '"jolt-mcp"'], ['punc', ']'], ['plain', ' '], ['punc', '}'],
        ['plain', '\n  '], ['punc', '}'], ['plain', '\n'], ['punc', '}'],
      ],
    },
    agents: {
      raw: '# AGENTS.md (generated via `npx jolt-mcp init --write`)\n- Read `.jolt/digest.json` before taking screenshots.\n- `status: "listening"` ↔ `[STOP_LIVE]` hands control back.',
      tokens: [
        ['punc', '# AGENTS.md (generated via `npx jolt-mcp init --write`)'], ['plain', '\n'],
        ['punc', '-'], ['plain', ' Read '], ['str', '`.jolt/digest.json`'], ['plain', ' before taking screenshots.\n'],
        ['punc', '-'], ['plain', ' '], ['key', 'status: "listening"'], ['plain', ' ↔ '], ['null', '[STOP_LIVE]'], ['plain', ' hands control back.'],
      ],
    },
  },
  adapters: {
    zustand: {
      tokens: [
        ['kw', 'import'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['fn', 'joltZustand'], ['plain', ' '], ['punc', '}'], ['plain', ' '], ['kw', 'from'], ['plain', ' '], ['str', "'vite-plugin-jolt/adapters'"], ['punc', ';'], ['plain', '\n'],
        ['fn', 'joltZustand'], ['punc', '('], ['str', "'cart'"], ['punc', ','], ['plain', ' useCartStore'], ['punc', ');'], ['plain', ' '], ['punc', '// 0 bytes in prod'],
      ],
    },
    pinia: {
      tokens: [
        ['kw', 'import'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['fn', 'joltPinia'], ['plain', ' '], ['punc', '}'], ['plain', ' '], ['kw', 'from'], ['plain', ' '], ['str', "'vite-plugin-jolt/adapters'"], ['punc', ';'], ['plain', '\n'],
        ['fn', 'joltPinia'], ['punc', '('], ['plain', 'pinia'], ['punc', ');'], ['plain', ' '], ['punc', '// exposes all Vue 3 stores'],
      ],
    },
    redux: {
      tokens: [
        ['kw', 'import'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['fn', 'joltRedux'], ['plain', ' '], ['punc', '}'], ['plain', ' '], ['kw', 'from'], ['plain', ' '], ['str', "'vite-plugin-jolt/adapters'"], ['punc', ';'], ['plain', '\n'],
        ['fn', 'joltRedux'], ['punc', '('], ['str', "'checkout'"], ['punc', ','], ['plain', ' store'], ['punc', ','], ['plain', ' '], ['punc', '{'], ['plain', ' applyPromo '], ['punc', '}'], ['punc', ');'],
      ],
    },
    three: {
      tokens: [
        ['kw', 'import'], ['plain', ' '], ['punc', '{'], ['plain', ' '], ['fn', 'joltThree'], ['plain', ' '], ['punc', '}'], ['plain', ' '], ['kw', 'from'], ['plain', ' '], ['str', "'vite-plugin-jolt/adapters'"], ['punc', ';'], ['plain', '\n'],
        ['fn', 'joltThree'], ['punc', '('], ['plain', 'scene'], ['punc', ','], ['plain', ' camera'], ['punc', ');'], ['plain', ' '], ['punc', '// auto-projected 3D Alt+Click'],
      ],
    },
  },
};

function renderTokenLines(preEl, tokenList) {
  if (!preEl) return;
  const codeEl = document.createElement('code');
  for (const [kind, text] of tokenList) {
    if (kind === 'plain') {
      codeEl.appendChild(document.createTextNode(text));
    } else {
      const span = document.createElement('span');
      span.className = `tok-${kind}`;
      span.textContent = text;
      codeEl.appendChild(span);
    }
  }
  preEl.replaceChildren(codeEl);
}

let activeInstallTab = 'vite';
els.installTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.installTab || 'vite';
    const spec = CODE_SNIPPETS.install[key];
    if (!spec) return;
    activeInstallTab = key;
    els.installTabs.forEach((b) => {
      const isAct = b === tab;
      b.classList.toggle('is-active', isAct);
      b.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
    renderTokenLines(els.installCode, spec.tokens);
  });
});

if (els.copyInstallBtn) {
  els.copyInstallBtn.addEventListener('click', async () => {
    const spec = CODE_SNIPPETS.install[activeInstallTab];
    if (!spec || !navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText(spec.raw);
      els.copyInstallBtn.textContent = 'Copied ✓';
      setTimeout(() => {
        els.copyInstallBtn.textContent = 'Copy';
      }, 1500);
    } catch {}
  });
}

els.adapterTabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const key = tab.dataset.adapterTab || 'zustand';
    const spec = CODE_SNIPPETS.adapters[key];
    if (!spec) return;
    els.adapterTabs.forEach((b) => {
      const isAct = b === tab;
      b.classList.toggle('is-active', isAct);
      b.setAttribute('aria-selected', isAct ? 'true' : 'false');
    });
    renderTokenLines(els.adapterCode, spec.tokens);
  });
});

if (els.copyCliBtn) {
  els.copyCliBtn.addEventListener('click', async () => {
    if (!navigator.clipboard?.writeText) return;
    try {
      await navigator.clipboard.writeText('npm install -D vite-plugin-jolt && npx jolt-mcp init --write');
      els.copyCliBtn.textContent = 'Command copied ✓';
      setTimeout(() => {
        els.copyCliBtn.textContent = 'Copy command';
      }, 1800);
    } catch {}
  });
}

if (els.demoTargetBtn) {
  els.demoTargetBtn.addEventListener('click', () => {
    const rect = els.demoTargetBtn.getBoundingClientRect();
    const loc = els.demoTargetBtn.getAttribute('data-jolt-loc') || 'playground/index.html:212:13';
    if (els.demoTargetLog) {
      els.demoTargetLog.hidden = false;
      els.demoTargetLog.dataset.state = 'ok';
      els.demoTargetLog.textContent = `Simulated pin · @jolt:${loc} · ${Math.round(rect.width)}×${Math.round(rect.height)}px · flex parent (~280 tok) — hold Alt+Click anywhere to test live.`;
    }
    if (window.__JOLT__ && typeof window.__JOLT__.recordStoreEvent === 'function') {
      window.__JOLT__.recordStoreEvent(`pin:${loc}`, { width: Math.round(rect.width), height: Math.round(rect.height) });
    }
  });
}

if (els.demoLoopBtn) {
  els.demoLoopBtn.addEventListener('click', async () => {
    els.demoLoopBtn.disabled = true;
    const stepLog = (text, st = 'warn') => {
      if (els.demoTargetLog) {
        els.demoTargetLog.hidden = false;
        els.demoTargetLog.dataset.state = st;
        els.demoTargetLog.textContent = text;
      }
    };
    stepLog('1/4 · Simulated Alt+Click on #btn-checkout (exact source loc sent)…', 'ok');
    await new Promise((r) => setTimeout(r, 650));
    applyMock500(true);
    stepLog('2/4 · Agent arms MOCK HTTP 500 on POST /api/checkout…', 'warn');
    await new Promise((r) => setTimeout(r, 750));
    await runCheckoutRequest();
    stepLog('3/4 · HTTP 500 failure experienced live & recorded in Flight Recorder…', 'error');
    await new Promise((r) => setTimeout(r, 650));
    stepLog('4/4 · Agent proposes UI fix via Spotlight Popin.', 'ok');
    window.__JOLT__?.showSpotlight?.({
      target: '#btn-checkout',
      variant: 'preview',
      title: 'HTTP 500 intercepted',
      message: 'The button stays active after POST /api/checkout failed. Show a retry state?',
      previewCss: {
        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
        color: '#ffffff',
      },
      confirmLabel: '✓ Apply fix',
      cancelLabel: '✕ Close',
      keepPreviewOnConfirm: false,
    });
    els.demoLoopBtn.disabled = false;
  });
}

let spotlightStep = 0;
if (els.demoSpotlightBtn) {
  els.demoSpotlightBtn.addEventListener('click', () => {
    if (!window.__JOLT__ || typeof window.__JOLT__.showSpotlight !== 'function') return;
    spotlightStep = (spotlightStep + 1) % 2;
    if (spotlightStep === 1) {
      window.__JOLT__.showSpotlight({
        target: '#btn-checkout',
        variant: 'preview',
        title: 'In-memory CSS Preview',
        message: 'Want to switch this button to indigo? Closing reverts the original emerald style.',
        previewCss: {
          background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
          color: '#ffffff',
        },
        confirmNote: 'Apply indigo style on #btn-checkout',
        confirmLabel: '✓ Apply',
        cancelLabel: '✕ Cancel preview',
        keepPreviewOnConfirm: true,
      });
    } else {
      window.__JOLT__.showSpotlight({
        target: 'OrbitalTorus',
        variant: 'question',
        title: '3D Object detected (item-2)',
        message: 'Is this the orbital ring in the WebGL2 viewport you want to reposition?',
        confirmNote: 'Move OrbitalTorus#item-2 further right',
        confirmLabel: '✓ Yes, that mesh',
        cancelLabel: '✕ No',
      });
    }
  });
}

syncUI();
renderHighlightedJson(els.digestPreview, SAMPLE_DIGEST_PREVIEW);
initWebGLScene(els.canvas, state);
