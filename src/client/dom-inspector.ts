import {
  JOLT_HUD_TAG,
  JOLT_IGNORE_ATTR,
  JOLT_LIMITS,
  JOLT_LOC_ATTR,
  RADIO_CSS_PROPS,
} from '../shared/constants.ts';

/**
 * Generates the on-demand DOM & CSS Radio inspector.
 * Uses checkVisibility() and textContent instead of getBoundingClientRect loops or innerText
 * so idle pages incur zero reflows.
 */
export function buildDomInspectorScript(): string {
  const radioPropsJson = JSON.stringify(RADIO_CSS_PROPS);

  return `
  const RADIO_PROPS = ${radioPropsJson};

  function isIgnoredDomNode(el) {
    if (!el || !(el instanceof Element)) return true;
    if (el.tagName.toLowerCase() === '${JOLT_HUD_TAG}') return true;
    return !!el.closest('${JOLT_HUD_TAG}, [${JOLT_IGNORE_ATTR}]');
  }

  function isElementVisible(el) {
    if (typeof el.checkVisibility === 'function') {
      return el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true });
    }
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  function extractCompactA11y() {
    const selector = 'button, a[href], input, select, textarea, [role], h1, h2, h3, canvas, [data-agent-id]';
    const nodes = [];
    const matched = document.querySelectorAll(selector);

    for (let i = 0; i < matched.length; i++) {
      const el = matched[i];
      if (isIgnoredDomNode(el) || !isElementVisible(el)) continue;

      const role = el.getAttribute('role') || el.tagName.toLowerCase();
      const rawName =
        el.getAttribute('aria-label') ||
        el.textContent ||
        el.getAttribute('placeholder') ||
        el.id ||
        '';
      const name = rawName.trim().replace(/\\s+/g, ' ').slice(0, 60);
      const loc = el.getAttribute('${JOLT_LOC_ATTR}') || undefined;
      const refId = el.getAttribute('data-agent-id') || el.id || undefined;

      const node = { role, name };
      if (loc) node.loc = loc;
      if (refId) node.refId = refId;

      if ('value' in el && el.value !== undefined && el.value !== '') {
        const isPassword = el instanceof HTMLInputElement && el.type === 'password';
        node.value = isPassword ? '[REDACTED]' : String(el.value).slice(0, 40);
      }
      if (document.activeElement === el) {
        node.locked = true;
      }

      nodes.push(node);
      if (nodes.length >= ${JOLT_LIMITS.MAX_A11Y_NODES}) break;
    }
    return nodes;
  }

  const FLEX_ONLY_PROPS = new Set([
    'flexDirection',
    'justifyContent',
    'alignItems',
    'flexWrap',
    'flexShrink',
  ]);
  const SKIP_DEFAULT_VALS = new Set(['normal', 'none', 'visible', 'auto', 'static', '0px']);

  function extractCssRadioBox(el) {
    const rect = el.getBoundingClientRect();
    const computed = window.getComputedStyle(el);
    const displayVal = String(computed.display || '');
    const isFlexOrGrid = displayVal.indexOf('flex') !== -1 || displayVal.indexOf('grid') !== -1;
    const styles = {};
    for (let i = 0; i < RADIO_PROPS.length; i++) {
      const prop = RADIO_PROPS[i];
      if (!isFlexOrGrid && FLEX_ONLY_PROPS.has(prop)) continue;
      const val = computed[prop];
      if (val === undefined || val === '') continue;
      if (prop !== 'display' && prop !== 'width' && prop !== 'height' && SKIP_DEFAULT_VALS.has(val)) {
        continue;
      }
      styles[prop] = val;
    }
    const loc = el.getAttribute('${JOLT_LOC_ATTR}') || undefined;
    return {
      tag: el.tagName.toLowerCase() + (el.id ? '#' + el.id : ''),
      ...(loc ? { loc } : {}),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      styles,
    };
  }

  function extractFrameworkComponents(el) {
    const names = [];
    if (!el) return names;
    try {
      const keys = Object.keys(el);
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].startsWith('__reactFiber$') || keys[i].startsWith('__reactInternalInstance$')) {
          let fiber = el[keys[i]];
          let steps = 0;
          while (fiber && steps < 18 && names.length < 6) {
            const t = fiber.type;
            if (typeof t === 'function' || (t && typeof t === 'object')) {
              const rawName = t.displayName || t.name || (t.render && (t.render.displayName || t.render.name));
              if (rawName && typeof rawName === 'string' && !names.includes(rawName)) {
                names.push(rawName);
              }
            }
            fiber = fiber.return;
            steps++;
          }
          break;
        }
      }
      if (names.length === 0 && el.__vueParentComponent) {
        let comp = el.__vueParentComponent;
        let steps = 0;
        while (comp && steps < 12 && names.length < 6) {
          const t = comp.type;
          const rawName = t && (t.__name || t.name);
          if (rawName && typeof rawName === 'string' && !names.includes(rawName)) {
            names.push(rawName);
          }
          comp = comp.parent;
          steps++;
        }
      }
    } catch {}
    return names;
  }

  function getViewportMetrics() {
    const doc = document.documentElement;
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: Number((window.devicePixelRatio || 1).toFixed(2)),
      horizontalOverflow: doc ? doc.scrollWidth > window.innerWidth + 1 : false,
      scrollY: Math.round(window.scrollY || 0),
    };
  }

  function inspectElementRadio(el, note) {
    if (!el || isIgnoredDomNode(el)) return null;
    const fwChain = extractFrameworkComponents(el);
    const componentChain = fwChain.length > 0 ? fwChain.map((n) => '<' + n + '>') : [];
    let cursor = el;
    let depth = 0;
    while (cursor && cursor !== document.documentElement && depth < 5) {
      const loc = cursor.getAttribute('${JOLT_LOC_ATTR}');
      const label = cursor.tagName.toLowerCase() + (cursor.id ? '#' + cursor.id : '') + (loc ? '@' + loc : '');
      if (componentChain.length < 8) {
        componentChain.push(label);
      }
      cursor = cursor.parentElement;
      depth++;
    }
    return {
      id: 'pin_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
      timestamp: Date.now(),
      note: String(note || '').slice(0, ${JOLT_LIMITS.MAX_STRING_LEN}),
      target: extractCssRadioBox(el),
      parent: el.parentElement && el.parentElement !== document.documentElement
        ? extractCssRadioBox(el.parentElement)
        : null,
      componentChain,
    };
  }

  function resolveElementByQuery(query) {
    if (!query) return null;
    if (query.loc) {
      const byLoc = document.querySelector('[${JOLT_LOC_ATTR}="' + CSS.escape(query.loc) + '"]');
      if (byLoc && !isIgnoredDomNode(byLoc)) return byLoc;
    }
    if (query.selector) {
      try {
        const bySel = document.querySelector(query.selector);
        if (bySel && !isIgnoredDomNode(bySel)) return bySel;
      } catch {
        return null;
      }
    }
    return null;
  }
`;
}
