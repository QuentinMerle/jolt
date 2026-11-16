import { JOLT_HUD_TAG, JOLT_LOC_ATTR } from '../shared/constants.ts';

/**
 * Generates the isolated <jolt-hud> Web Component (Shadow DOM + adoptedStyleSheets + ElementInternals).
 * Precision Carbon Monolith UI: a 44px matte carbon squircle with a single laser-comet border
 * that expands into a crisp engineering instrument panel, plus a theatrical cutout Spotlight
 * for Agent -> Browser confirmation, warnings, and in-memory CSS previews.
 */
export function buildJoltHudScript(): string {
  return `
  const hudTemplate = document.createElement('template');
  hudTemplate.innerHTML = \`
    <div class="spotlight-backdrop" hidden aria-hidden="true"></div>

    <div class="laser-layer" aria-hidden="true">
      <div class="laser-box" part="laser-box"></div>
      <div class="laser-label" part="laser-label"></div>
      <div class="pin-flash-box" part="pin-flash-box"></div>
      <div class="spotlight-box" part="spotlight-box" hidden></div>
    </div>

    <div class="spotlight-card" part="spotlight-card" hidden role="dialog" aria-live="polite">
      <div class="spot-head">
        <span class="spot-badge">QUESTION</span>
        <strong class="spot-title"></strong>
      </div>
      <p class="spot-msg"></p>
      <div class="spot-actions">
        <button type="button" class="spot-btn spot-btn-cancel">✕ Close</button>
        <button type="button" class="spot-btn spot-btn-confirm">✓ Confirm</button>
      </div>
    </div>

    <aside class="hud-shell" aria-label="Jolt White-Box Inspector">
      <div class="orb-toast" part="toast" hidden role="status" aria-live="polite"></div>

      <div class="jolt-capsule" part="capsule">
        <div class="laser-beam" aria-hidden="true"></div>

        <div class="capsule-surface">
          <button
            type="button"
            class="orb-face"
            title="Jolt ⚡ — Click to expand (Alt+Click to target)"
            aria-label="Open Jolt"
            aria-expanded="false"
          >
            <svg class="bolt-svg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M13.5 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13.5 2Z" />
            </svg>
          </button>

          <section class="capsule-content" aria-label="Jolt Panel">
            <header class="capsule-head">
              <div class="capsule-title-row">
                <svg class="bolt-mini" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M13.5 2L4.5 13.5H11.5L10.5 22L19.5 10.5H12.5L13.5 2Z" />
                </svg>
                <span class="status-tag">NOMINAL</span>
                <span class="drawer-status-text">Bridge Ready</span>
              </div>
              <div class="capsule-actions">
                <button type="button" class="btn-stop-live" hidden title="Stop listening and hand control back to IDE chat" aria-label="Stop listening">
                  <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                    <rect x="4" y="4" width="8" height="8" rx="1.5" />
                  </svg>
                  <span>Stop</span>
                </button>
                <button type="button" class="btn-icon btn-pick" title="Target an element (Alt+Click)" aria-label="Target an element">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="7" />
                    <line x1="12" y1="2" x2="12" y2="6" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="2" y1="12" x2="6" y2="12" />
                    <line x1="18" y1="12" x2="22" y2="12" />
                    <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                <button type="button" class="btn-icon btn-clear-alert" hidden title="Clear alerts" aria-label="Clear alerts">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
                    <path d="M3 3v5h5" />
                  </svg>
                </button>
                <button type="button" class="btn-icon btn-close" title="Collapse (Esc)" aria-label="Collapse">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </header>

            <div class="metrics-ribbon">
              <div class="metric-cell">
                <span class="metric-label">GPU · WEBGL2</span>
                <span class="metric-value stat-webgl">OFF</span>
              </div>
              <div class="metric-cell">
                <span class="metric-label">STATE · STORE</span>
                <span class="metric-value stat-stores">0 store</span>
              </div>
              <div class="metric-cell">
                <span class="metric-label">NET · FETCH</span>
                <span class="metric-value stat-mocks">200 LIVE</span>
              </div>
            </div>

            <div class="pin-zone">
              <div class="pin-header-row">
                <span class="pin-meta">Alt+Click · Target DOM or 3D</span>
                <button type="button" class="btn-clear-target" hidden title="Clear target" aria-label="Clear target">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
                    <line x1="17" y1="7" x2="7" y2="17" />
                    <line x1="7" y1="7" x2="17" y2="17" />
                  </svg>
                </button>
              </div>
              <form class="pin-form">
                <input
                  type="text"
                  class="pin-input"
                  placeholder="Instruction or fix (Enter)…"
                  autocomplete="off"
                />
                <button type="submit" class="btn-pin-submit" title="Pin and send to .jolt/inbox.json">PIN ↵</button>
              </form>
            </div>

            <footer class="signal-bar">
              <span class="signal-dot" aria-hidden="true"></span>
              <span class="signal-text">No runtime incidents</span>
            </footer>
          </section>
        </div>
      </div>
    </aside>
  \`;

  const hudSheet = new CSSStyleSheet();
  hudSheet.replaceSync(\`
    :host {
      --_hud-bg: var(--jolt-hud-bg, #090a0f);
      --_hud-surface: var(--jolt-hud-surface, #0d0f17);
      --_hud-fg: var(--jolt-hud-fg, #f1f5f9);
      --_hud-muted: var(--jolt-hud-muted, #64748b);
      --_hud-accent: var(--jolt-hud-accent, #38bdf8);

      /* Default: NOMINAL — Gentle Emerald Ambient Beam */
      --_beam-grad: conic-gradient(
        from 0deg,
        transparent 0deg 265deg,
        rgba(16, 185, 129, 0.16) 310deg,
        rgba(16, 185, 129, 0.72) 348deg,
        #6ee7b7 359deg,
        transparent 360deg
      );
      --_ring-speed: 11s;
      --_state-color: #10b981;
      --_bolt-fill: #10b981;
      --_glow: rgba(16, 185, 129, 0.24);

      color-scheme: only dark;
      color: var(--_hud-fg);
      accent-color: var(--_hud-accent);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      line-height: 1.4;
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 2147483647;
    }

    :host(:state(mocking)) {
      --_beam-grad: conic-gradient(
        from 0deg,
        transparent 0deg 260deg,
        rgba(245, 158, 11, 0.18) 308deg,
        rgba(245, 158, 11, 0.75) 348deg,
        #fde68a 359deg,
        transparent 360deg
      );
      --_ring-speed: 7.5s;
      --_state-color: #f59e0b;
      --_bolt-fill: #10b981;
      --_glow: rgba(245, 158, 11, 0.24);
    }

    :host(:state(alert)) {
      --_beam-grad: conic-gradient(
        from 0deg,
        transparent 0deg 255deg,
        rgba(244, 63, 94, 0.22) 305deg,
        rgba(251, 113, 133, 0.8) 346deg,
        #fecdd3 359deg,
        transparent 360deg
      );
      --_ring-speed: 5.5s;
      --_state-color: #fb7185;
      --_bolt-fill: #fb7185;
      --_glow: rgba(244, 63, 94, 0.3);
    }

    :host(:state(listening)) {
      --_beam-grad: conic-gradient(
        from 0deg,
        transparent 0deg 255deg,
        rgba(56, 189, 248, 0.16) 305deg,
        rgba(56, 189, 248, 0.72) 346deg,
        #7dd3fc 359deg,
        transparent 360deg
      );
      --_ring-speed: 8s;
      --_state-color: #38bdf8;
      --_bolt-fill: #38bdf8;
      --_glow: rgba(56, 189, 248, 0.24);
    }

    :host(:state(working)),
    :host(:state(inspecting)) {
      --_beam-grad: conic-gradient(
        from 0deg,
        transparent 0deg 245deg,
        rgba(56, 189, 248, 0.18) 298deg,
        rgba(56, 189, 248, 0.72) 345deg,
        #bae6fd 359deg,
        transparent 360deg
      );
      --_ring-speed: 5.5s;
      --_state-color: #38bdf8;
      --_bolt-fill: #7dd3fc;
      --_glow: rgba(56, 189, 248, 0.26);
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    button, input {
      font: inherit;
      color: inherit;
    }

    [hidden] {
      display: none !important;
    }

    @keyframes jolt-comet-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @keyframes jolt-toast-in {
      from {
        opacity: 0;
        transform: translateY(4px) scale(0.96);
      }
      to {
        opacity: 1;
        transform: translateY(0) scale(1);
      }
    }

    @keyframes jolt-pin-pulse {
      0% {
        box-shadow: 0 0 0 0 rgba(56, 189, 248, 0.65);
        opacity: 1;
      }
      60% {
        box-shadow: 0 0 0 10px rgba(16, 185, 129, 0);
        opacity: 0.95;
      }
      100% {
        box-shadow: 0 0 0 14px rgba(16, 185, 129, 0);
        opacity: 0;
      }
    }

    @keyframes jolt-sonar {
      0% {
        transform: scale(1);
        opacity: 0.85;
      }
      100% {
        transform: scale(1.09);
        opacity: 0;
      }
    }

    .spotlight-backdrop {
      position: fixed;
      inset: 0;
      background: transparent;
      pointer-events: auto;
      cursor: pointer;
    }

    .laser-layer {
      position: fixed;
      inset: 0;
      pointer-events: none;
    }

    .laser-box {
      position: fixed;
      border: 1.5px solid var(--_hud-accent);
      background: rgba(56, 189, 248, 0.1);
      border-radius: 6px;
      box-shadow: 0 0 0 1px rgba(9, 10, 15, 0.8);
      display: none;
    }

    .laser-label {
      position: fixed;
      background: #090a0f;
      color: #e2e8f0;
      border: 1px solid rgba(56, 189, 248, 0.5);
      border-radius: 6px;
      padding: 3px 8px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.6);
      display: none;
    }

    .pin-flash-box {
      position: fixed;
      border-radius: 8px;
      border: 1.5px solid var(--_state-color);
      background: rgba(56, 189, 248, 0.08);
      display: none;
      pointer-events: none;
    }

    .pin-flash-box[data-active="true"] {
      display: block;
      animation: jolt-pin-pulse 1.1s ease-out 2;
    }

    /* High-Impact Theatre Cutout Spotlight */
    .spotlight-box,
    .spotlight-card {
      --_spot-color: #38bdf8;
    }

    .spotlight-box[data-variant="warning"],
    .spotlight-card[data-variant="warning"] {
      --_spot-color: #f59e0b;
    }

    .spotlight-box[data-variant="error"],
    .spotlight-card[data-variant="error"] {
      --_spot-color: #fb7185;
    }

    .spotlight-box[data-variant="preview"],
    .spotlight-card[data-variant="preview"] {
      --_spot-color: #10b981;
    }

    .spotlight-box {
      position: fixed;
      border-radius: 7px;
      border: 2px solid var(--_spot-color);
      background: transparent;
      box-shadow:
        0 0 0 9999px rgba(2, 4, 10, 0.72),
        0 0 0 2px var(--_spot-color),
        0 0 34px color-mix(in srgb, var(--_spot-color) 60%, transparent);
      pointer-events: none;
      transition: all 0.25s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .spotlight-box::after {
      content: "";
      position: absolute;
      inset: -6px;
      border-radius: 10px;
      border: 2px solid var(--_spot-color);
      animation: jolt-sonar 1.7s cubic-bezier(0.16, 1, 0.3, 1) infinite;
      pointer-events: none;
    }

    .spotlight-card {
      position: fixed;
      pointer-events: auto;
      width: min(332px, calc(100vw - 24px));
      background: #0d111d;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-top: 2px solid var(--_spot-color);
      border-radius: 8px;
      padding: 13px 14px;
      box-shadow:
        0 24px 60px rgba(0, 0, 0, 0.85),
        0 0 28px color-mix(in srgb, var(--_spot-color) 28%, transparent);
      display: flex;
      flex-direction: column;
      gap: 8px;
      animation: jolt-toast-in 0.2s cubic-bezier(0.22, 1, 0.36, 1);
    }

    .spot-head {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      min-width: 0;
    }

    .spot-badge {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      padding: 2px 6px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--_spot-color) 18%, transparent);
      border: 1px solid color-mix(in srgb, var(--_spot-color) 42%, transparent);
      color: var(--_spot-color);
      flex-shrink: 0;
      margin-top: 1px;
    }

    .spot-title {
      font-size: 12.5px;
      font-weight: 600;
      color: #f8fafc;
      line-height: 1.35;
      white-space: normal;
    }

    .spot-msg {
      margin: 0;
      font-size: 12px;
      line-height: 1.48;
      color: #cbd5e1;
    }

    .spot-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 2px;
    }

    .spot-btn {
      border-radius: 7px;
      padding: 5px 11px;
      font-size: 11.5px;
      font-weight: 600;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.14);
      background: rgba(255, 255, 255, 0.05);
      color: #e2e8f0;
      transition: background 0.14s ease, filter 0.14s ease;
    }

    .spot-btn-confirm {
      border-color: transparent;
      background: var(--_spot-color);
      color: #05080f;
    }

    .spot-btn:hover {
      filter: brightness(1.1);
    }

    /* HUD Shell & Monolith Capsule */
    .hud-shell {
      position: fixed;
      right: 18px;
      bottom: 18px;
      display: flex;
      align-items: flex-end;
      gap: 10px;
      pointer-events: none;
    }

    .orb-toast {
      pointer-events: auto;
      cursor: pointer;
      margin-bottom: 6px;
      background: #090a0f;
      color: #e2e8f0;
      border: 1px solid rgba(255, 255, 255, 0.14);
      border-left: 2.5px solid var(--_state-color);
      border-radius: 8px;
      padding: 6px 11px;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 500;
      max-width: min(290px, calc(100vw - 96px));
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.7), 0 0 18px var(--_glow);
      animation: jolt-toast-in 0.18s ease-out;
    }

    :host(:state(expanded)) .orb-toast {
      display: none !important;
    }

    .jolt-capsule {
      pointer-events: auto;
      position: relative;
      width: 44px;
      height: 44px;
      border-radius: 9px;
      overflow: hidden;
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 12px 32px rgba(0, 0, 0, 0.72), 0 0 18px var(--_glow);
      transition:
        width 0.36s cubic-bezier(0.22, 1, 0.36, 1),
        height 0.36s cubic-bezier(0.22, 1, 0.36, 1),
        border-radius 0.36s cubic-bezier(0.22, 1, 0.36, 1),
        box-shadow 0.3s ease,
        transform 0.2s ease;
    }

    :host(:not(:state(expanded))) .jolt-capsule:hover {
      transform: translateY(-1px) scale(1.04);
    }

    :host(:state(expanded)) .jolt-capsule {
      width: min(364px, calc(100vw - 36px));
      height: 214px;
      border-radius: 10px;
      box-shadow: 0 22px 56px rgba(0, 0, 0, 0.85), 0 0 24px var(--_glow);
    }

    .laser-beam {
      position: absolute;
      left: 50%;
      top: 50%;
      width: 480px;
      height: 480px;
      margin-left: -240px;
      margin-top: -240px;
      background: var(--_beam-grad);
      opacity: 0.72;
      pointer-events: none;
      will-change: transform;
      animation: jolt-comet-spin var(--_ring-speed) linear infinite;
      transition: opacity 0.3s ease;
    }

    :host(:state(expanded)) .laser-beam {
      opacity: 0.52;
    }

    .capsule-surface {
      position: absolute;
      inset: 1.5px;
      border-radius: 7.5px;
      overflow: hidden;
      background: linear-gradient(180deg, #10131e 0%, var(--_hud-bg) 100%);
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
      transition: border-radius 0.36s cubic-bezier(0.22, 1, 0.36, 1);
    }

    :host(:state(expanded)) .capsule-surface {
      border-radius: 8.5px;
    }

    .orb-face {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
      padding: 0;
      margin: 0;
      background: transparent;
      cursor: pointer;
      display: grid;
      place-items: center;
      opacity: 1;
      transform: scale(1);
      transition: opacity 0.18s ease, transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
    }

    :host(:state(expanded)) .orb-face {
      opacity: 0;
      transform: scale(0.45);
      pointer-events: none;
    }

    .bolt-svg {
      width: 18px;
      height: 18px;
      fill: var(--_bolt-fill);
      filter: drop-shadow(0 0 6px var(--_glow));
      transition: fill 0.25s ease;
    }

    .capsule-content {
      position: absolute;
      right: 0;
      bottom: 0;
      width: min(360px, calc(100vw - 40px));
      height: 210px;
      padding: 12px 13px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 8px;
      opacity: 0;
      visibility: hidden;
      transform: scale(0.96);
      pointer-events: none;
      transition:
        opacity 0.2s ease,
        transform 0.28s cubic-bezier(0.22, 1, 0.36, 1),
        visibility 0s linear 0.2s;
    }

    :host(:state(expanded)) .capsule-content {
      opacity: 1;
      visibility: visible;
      transform: scale(1);
      pointer-events: auto;
      transition:
        opacity 0.22s ease 0.07s,
        transform 0.28s cubic-bezier(0.22, 1, 0.36, 1) 0.04s,
        visibility 0s;
    }

    .capsule-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }

    .capsule-title-row {
      display: flex;
      align-items: center;
      gap: 6px;
      min-width: 0;
    }

    .bolt-mini {
      width: 13px;
      height: 13px;
      fill: var(--_bolt-fill);
      flex-shrink: 0;
    }

    .status-tag {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.07em;
      padding: 2px 5px;
      border-radius: 4px;
      background: color-mix(in srgb, var(--_state-color) 16%, transparent);
      border: 1px solid color-mix(in srgb, var(--_state-color) 36%, transparent);
      color: var(--_state-color);
      flex-shrink: 0;
    }

    .drawer-status-text {
      font-size: 12px;
      font-weight: 500;
      color: #cbd5e1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .capsule-actions {
      display: flex;
      align-items: center;
      gap: 2px;
      flex-shrink: 0;
    }

    .btn-icon {
      border: 0;
      background: transparent;
      border-radius: 6px;
      width: 24px;
      height: 24px;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      color: var(--_hud-muted);
      transition: background 0.14s ease, color 0.14s ease;
    }

    .btn-icon svg {
      width: 13.5px;
      height: 13.5px;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
    }

    .btn-stop-live {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 22px;
      padding: 0 7px;
      margin-right: 2px;
      border-radius: 5px;
      border: 1px solid rgba(251, 113, 133, 0.45);
      background: rgba(244, 63, 94, 0.14);
      color: #fda4af;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: background 0.14s ease, border-color 0.14s ease;
    }

    .btn-stop-live svg {
      width: 9px;
      height: 9px;
      flex-shrink: 0;
    }

    .btn-stop-live:hover {
      background: rgba(244, 63, 94, 0.26);
      border-color: rgba(251, 113, 133, 0.7);
      color: #ffe4e6;
    }

    :host(:state(inspecting)) .btn-pick {
      background: rgba(56, 189, 248, 0.2);
      color: #38bdf8;
    }

    /* Engineering Telemetry Ribbon */
    .metrics-ribbon {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      background: var(--_hud-surface);
      border: 1px solid rgba(255, 255, 255, 0.07);
      border-radius: 9px;
      padding: 6px 0;
    }

    .metric-cell {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
      min-width: 0;
      padding: 0 9px;
    }

    .metric-cell + .metric-cell {
      border-left: 1px solid rgba(255, 255, 255, 0.07);
    }

    .metric-label {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 8.5px;
      font-weight: 600;
      letter-spacing: 0.07em;
      color: var(--_hud-muted);
    }

    .metric-value {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      font-weight: 600;
      color: #f8fafc;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }

    .stat-mocks[data-mock="true"] {
      color: #fbbf24;
    }

    /* Recessed Input & Platinum Submit Key */
    .pin-zone {
      display: flex;
      flex-direction: column;
      gap: 5px;
    }

    .pin-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
      padding: 0 1px;
    }

    .pin-meta {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10px;
      color: var(--_hud-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .pin-meta[data-targeted="true"] {
      color: #7dd3fc;
    }

    .btn-clear-target {
      border: 0;
      background: rgba(255, 255, 255, 0.06);
      color: var(--_hud-muted);
      border-radius: 5px;
      width: 17px;
      height: 17px;
      display: inline-grid;
      place-items: center;
      cursor: pointer;
      flex-shrink: 0;
    }

    .btn-clear-target svg {
      width: 10px;
      height: 10px;
    }

    .btn-clear-target:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #f8fafc;
    }

    .pin-form {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #050609;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 9px;
      padding: 3px 3px 3px 10px;
      transition: border-color 0.15s ease;
    }

    .pin-form:focus-within {
      border-color: rgba(255, 255, 255, 0.3);
    }

    .pin-input {
      flex: 1;
      min-width: 0;
      background: transparent;
      border: 0;
      outline: none;
      color: #f8fafc;
      font-size: 12px;
      padding: 4px 0;
    }

    .pin-input::placeholder {
      color: #475569;
    }

    .btn-pin-submit {
      border: 0;
      background: #f1f5f9;
      color: #090a0f;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 700;
      letter-spacing: 0.04em;
      border-radius: 6px;
      padding: 5px 10px;
      font-size: 10.5px;
      cursor: pointer;
      flex-shrink: 0;
      transition: background 0.14s ease, transform 0.12s ease;
    }

    .btn-pin-submit:hover {
      background: #ffffff;
    }

    .btn-pin-submit:active {
      transform: scale(0.96);
    }

    /* Footer Telemetry Strip */
    .signal-bar {
      display: flex;
      align-items: center;
      gap: 7px;
      padding: 5px 8px;
      border-radius: 7px;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid rgba(255, 255, 255, 0.05);
      min-width: 0;
    }

    :host(:state(alert)) .signal-bar {
      background: rgba(225, 29, 72, 0.1);
      border-color: rgba(251, 113, 133, 0.25);
    }

    .signal-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: var(--_state-color);
      box-shadow: 0 0 8px var(--_glow);
      flex-shrink: 0;
    }

    .signal-text {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 10.5px;
      color: #94a3b8;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    :host(:state(alert)) .signal-text {
      color: #fda4af;
    }
  \`);

  class JoltHudElement extends HTMLElement {
    #internals;
    #inspecting = false;
    #expanded = false;
    #pendingEl = null;
    #pendingWebGLNode = null;
    #lastPinnedEl = null;
    #lastPinnedRect = null;
    #hoveredEl = null;
    #hoveredWebGLNode = null;
    #altHeld = false;
    #agentStatus = null;
    #localPinAt = 0;
    #lastSeenErrorId = null;
    #uiTimer = null;
    #toastTimer = null;
    #workingTimer = null;
    #flashTimer = null;
    #spotlightRestore = null;
    #spotlightSpec = null;
    #spotlightDomEl = null;
    #spotlightWebGL = null;
    #boundKeyDown;
    #boundKeyUp;
    #boundBlur;
    #boundMouseMove;
    #boundClick;

    constructor() {
      super();
      this.#internals = this.attachInternals();
      this.attachShadow({ mode: 'open', delegatesFocus: true });
      this.shadowRoot.adoptedStyleSheets = [hudSheet];
      this.shadowRoot.append(hudTemplate.content.cloneNode(true));

      this.#boundKeyDown = (e) => {
        if (e.key === 'Alt' && !this.#altHeld) {
          this.#altHeld = true;
          this.#setInspecting(true);
        } else if (e.key === 'Escape') {
          if (this.#inspecting) {
            this.#altHeld = false;
            this.#setInspecting(false);
          } else if (this.#spotlightSpec) {
            this.#clearSpotlight(true);
          } else if (this.#expanded) {
            this.#setExpanded(false);
          }
        }
      };

      this.#boundKeyUp = (e) => {
        if (e.key === 'Alt' && this.#altHeld) {
          this.#altHeld = false;
          this.#setInspecting(false);
        }
      };

      this.#boundBlur = () => {
        if (this.#altHeld) {
          this.#altHeld = false;
          this.#setInspecting(false);
        }
      };

      this.#boundMouseMove = (e) => {
        if (!this.#inspecting) return;
        const el = document.elementFromPoint(e.clientX, e.clientY);
        if (!el || isIgnoredDomNode(el)) {
          this.#hideLaser();
          return;
        }
        this.#hoveredEl = el;
        if (el === webglState.canvas) {
          const glNode = pickWebGLSceneNode(e.clientX, e.clientY);
          if (glNode && glNode.screenRect) {
            this.#hoveredWebGLNode = glNode;
            const posText = Array.isArray(glNode.position)
              ? glNode.position.map((v) => Number(v).toFixed(2)).join(', ')
              : '0, 0, 0';
            this.#drawLaserRect(
              glNode.screenRect,
              'webgl:' + glNode.name + (glNode.id ? '#' + glNode.id : '') + ' · [' + posText + ']',
            );
            return;
          }
        }
        this.#hoveredWebGLNode = null;
        this.#drawLaser(el);
      };

      this.#boundClick = (e) => {
        if (!this.#inspecting) return;
        if (isFromJoltHud(e)) return;
        const target = this.#hoveredEl || (e.target instanceof Element ? e.target : null);
        if (!target || isIgnoredDomNode(target)) return;
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const pickedWebGL = this.#hoveredWebGLNode;
        this.#hoveredWebGLNode = null;
        this.#openComposerFor(target, pickedWebGL);
        this.#setInspecting(false);
        this.#altHeld = false;
      };
    }

    connectedCallback() {
      this.#wireLocalControls();
      window.addEventListener('keydown', this.#boundKeyDown, true);
      window.addEventListener('keyup', this.#boundKeyUp, true);
      window.addEventListener('blur', this.#boundBlur);
      window.addEventListener('mousemove', this.#boundMouseMove, { passive: true });
      window.addEventListener('click', this.#boundClick, true);

      try {
        const pendingToast = sessionStorage.getItem('__jolt_hmr_toast');
        if (pendingToast) {
          sessionStorage.removeItem('__jolt_hmr_toast');
          this.setAgentStatus('done', pendingToast);
        }
      } catch {}

      this.refreshView();
      if (!this.#uiTimer) {
        this.#uiTimer = setInterval(() => this.refreshView(), 1000);
      }
    }

    disconnectedCallback() {
      joltLaserActive = false;
      window.removeEventListener('keydown', this.#boundKeyDown, true);
      window.removeEventListener('keyup', this.#boundKeyUp, true);
      window.removeEventListener('blur', this.#boundBlur);
      window.removeEventListener('mousemove', this.#boundMouseMove);
      window.removeEventListener('click', this.#boundClick, true);
      if (this.#uiTimer) {
        clearInterval(this.#uiTimer);
        this.#uiTimer = null;
      }
      if (this.#toastTimer) {
        clearTimeout(this.#toastTimer);
        this.#toastTimer = null;
      }
      if (this.#workingTimer) {
        clearTimeout(this.#workingTimer);
        this.#workingTimer = null;
      }
      if (this.#flashTimer) {
        clearTimeout(this.#flashTimer);
        this.#flashTimer = null;
      }
      this.#clearSpotlight(true);
    }

    #wireLocalControls() {
      if (this.__wired) return;
      this.__wired = true;
      const root = this.shadowRoot;

      root.querySelector('.orb-face').addEventListener('click', () => {
        this.#setExpanded(true);
      });
      root.querySelector('.orb-toast').addEventListener('click', () => {
        this.#setExpanded(true);
      });
      root.querySelector('.btn-close').addEventListener('click', () => {
        this.#setExpanded(false);
      });
      root.querySelector('.btn-pick').addEventListener('click', () => {
        this.#setInspecting(!this.#inspecting);
      });
      root.querySelector('.btn-stop-live').addEventListener('click', async () => {
        this.#internals.states.delete('listening');
        this.#internals.states.delete('working');
        if (this.#workingTimer) {
          clearTimeout(this.#workingTimer);
          this.#workingTimer = null;
        }
        const stopPin = inspectElementRadio(document.body, '[STOP_LIVE]');
        if (stopPin) {
          await submitPinnedElement(stopPin);
        }
        this.setAgentStatus('done', 'Listening stopped — control returned');
      });
      root.querySelector('.btn-clear-target').addEventListener('click', () => {
        this.#resetComposerToGlobal();
      });
      root.querySelector('.btn-clear-alert').addEventListener('click', () => {
        flightBuffer.length = 0;
        this.#lastSeenErrorId = null;
        this.#internals.states.delete('alert');
        this.setAgentStatus('done', 'Alerts cleared');
        scheduleBackgroundReport('clear-alert');
      });
      root.querySelector('.spotlight-backdrop').addEventListener('click', () => {
        this.#clearSpotlight(true);
      });
      root.querySelector('.spot-btn-confirm').addEventListener('click', async () => {
        const spec = this.#spotlightSpec;
        const domEl = this.#spotlightDomEl;
        const wn = this.#spotlightWebGL;
        const keepPreview = !spec || spec.keepPreviewOnConfirm !== false;
        this.#clearSpotlight(!keepPreview);
        if (!spec) return;
        const confirmNote = '[SPOTLIGHT_CONFIRM] ' + (spec.confirmNote || spec.title || spec.target || 'OK');
        const targetEl = domEl || (webglState && webglState.canvas) || document.body;
        const pinned = inspectElementRadio(targetEl, confirmNote);
        if (pinned) {
          if (wn) {
            pinned.target = {
              tag: 'webgl:' + wn.name + (wn.id ? '#' + wn.id : ''),
              loc: wn.loc || 'playground/webgl-scene.js',
              rect: wn.screenRect || pinned.target.rect,
              styles: {
                display: 'webgl-mesh (' + (wn.type || 'Mesh') + ')',
                position: JSON.stringify(wn.position || [0, 0, 0]),
                scale: String(wn.scale ?? 1),
                color: String(wn.color || ''),
              },
            };
          }
          this.#localPinAt = Date.now();
          this.#pulseWorking('Confirmation sent…', 45000);
          await submitPinnedElement(pinned);
        }
      });
      root.querySelector('.spot-btn-cancel').addEventListener('click', async () => {
        const spec = this.#spotlightSpec;
        const domEl = this.#spotlightDomEl;
        this.#clearSpotlight(true);
        if (spec && spec.notifyOnCancel) {
          const cancelPin = inspectElementRadio(
            domEl || document.body,
            '[SPOTLIGHT_CANCEL] ' + (spec.title || spec.target || 'Cancelled'),
          );
          if (cancelPin) {
            await submitPinnedElement(cancelPin);
          }
        }
      });
      root.querySelector('.pin-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = root.querySelector('.pin-input');
        const note = input.value.trim();
        if (!note) return;

        const targetEl = this.#pendingEl || document.body;
        const webglNode = this.#pendingWebGLNode;
        const pinned = inspectElementRadio(targetEl, note);
        if (pinned) {
          this.#localPinAt = Date.now();
          let label = targetEl === document.body
            ? 'page'
            : (pinned.target.loc || pinned.target.tag);
          if (webglNode) {
            pinned.target = {
              tag: 'webgl:' + webglNode.name + (webglNode.id ? '#' + webglNode.id : ''),
              loc: webglNode.loc || 'playground/webgl-scene.js',
              rect: webglNode.screenRect || pinned.target.rect,
              styles: {
                display: 'webgl-mesh (' + (webglNode.type || 'Mesh') + ')',
                position: JSON.stringify(webglNode.position || [0, 0, 0]),
                scale: String(webglNode.scale ?? 1),
                color: String(webglNode.color || ''),
              },
            };
            label = pinned.target.tag;
            this.#lastPinnedEl = null;
            this.#lastPinnedRect = webglNode.screenRect || null;
            if (this.#lastPinnedRect) {
              this.#flashTarget(this.#lastPinnedRect);
            }
          } else {
            this.#lastPinnedRect = null;
            this.#lastPinnedEl = targetEl !== document.body ? targetEl : null;
            if (this.#lastPinnedEl) {
              this.#flashTarget(this.#lastPinnedEl);
            }
          }
          this.#pulseWorking('Pin sent: ' + label, 45000);
          await submitPinnedElement(pinned);
          if (pinned.target.loc && targetEl !== document.body && navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText('@jolt:' + pinned.target.loc).catch(() => {});
          }
        }
        input.value = '';
        this.#resetComposerToGlobal();
        this.refreshView();
      });
    }

    #setInspecting(on) {
      this.#inspecting = !!on;
      joltLaserActive = this.#inspecting;
      if (this.#inspecting) {
        this.#internals.states.add('inspecting');
        this.#showToast('Alt+Click any DOM or 3D element', 3000);
      } else {
        this.#internals.states.delete('inspecting');
        this.#hideLaser();
      }
      this.refreshView();
    }

    #setExpanded(on) {
      this.#expanded = !!on;
      const orbFace = this.shadowRoot.querySelector('.orb-face');
      const toast = this.shadowRoot.querySelector('.orb-toast');
      orbFace.setAttribute('aria-expanded', this.#expanded ? 'true' : 'false');
      if (this.#expanded) {
        if (toast) toast.hidden = true;
        this.#internals.states.add('expanded');
        this.refreshView();
      } else {
        this.#internals.states.delete('expanded');
      }
    }

    #showToast(text, durationMs = 3500) {
      if (this.#expanded) return;
      const toast = this.shadowRoot.querySelector('.orb-toast');
      if (!toast) return;
      toast.textContent = text;
      toast.hidden = false;
      if (this.#toastTimer) clearTimeout(this.#toastTimer);
      this.#toastTimer = setTimeout(() => {
        toast.hidden = true;
        this.#toastTimer = null;
      }, durationMs);
    }

    #pulseWorking(message, durationMs = 45000) {
      this.#internals.states.add('working');
      this.#agentStatus = { status: 'working', message, expiresAt: Date.now() + durationMs };
      this.#showToast(message, durationMs);
      if (this.#workingTimer) clearTimeout(this.#workingTimer);
      this.#workingTimer = setTimeout(() => {
        this.#internals.states.delete('working');
        this.#workingTimer = null;
        this.refreshView();
      }, durationMs);
    }

    #flashTarget(elOrRect) {
      if (!elOrRect) return;
      let rect = null;
      if (typeof elOrRect.getBoundingClientRect === 'function') {
        if (!elOrRect.isConnected) return;
        rect = elOrRect.getBoundingClientRect();
      } else if (typeof elOrRect.x === 'number' || typeof elOrRect.left === 'number') {
        rect = {
          left: elOrRect.left ?? elOrRect.x,
          top: elOrRect.top ?? elOrRect.y,
          width: elOrRect.width,
          height: elOrRect.height,
        };
      }
      if (!rect || rect.width <= 0 || rect.height <= 0) return;
      const box = this.shadowRoot.querySelector('.pin-flash-box');
      if (!box) return;
      box.style.left = rect.left + 'px';
      box.style.top = rect.top + 'px';
      box.style.width = rect.width + 'px';
      box.style.height = rect.height + 'px';
      box.dataset.active = 'false';
      void box.offsetWidth;
      box.dataset.active = 'true';
      if (this.#flashTimer) clearTimeout(this.#flashTimer);
      this.#flashTimer = setTimeout(() => {
        box.dataset.active = 'false';
        this.#flashTimer = null;
      }, 2200);
    }

    #drawLaserRect(rect, labelText) {
      const left = rect.left ?? rect.x;
      const top = rect.top ?? rect.y;
      const width = rect.width;
      const height = rect.height;
      const box = this.shadowRoot.querySelector('.laser-box');
      const label = this.shadowRoot.querySelector('.laser-label');
      box.style.display = 'block';
      box.style.left = left + 'px';
      box.style.top = top + 'px';
      box.style.width = width + 'px';
      box.style.height = height + 'px';

      label.textContent = labelText;
      label.style.display = 'block';
      const topPos = top > 28 ? top - 26 : top + height + 4;
      label.style.left = Math.max(8, Math.min(window.innerWidth - 280, left)) + 'px';
      label.style.top = Math.max(8, topPos) + 'px';
    }

    #drawLaser(el) {
      const rect = el.getBoundingClientRect();
      const loc = el.getAttribute('${JOLT_LOC_ATTR}') || el.tagName.toLowerCase();
      this.#drawLaserRect(
        rect,
        el.tagName.toLowerCase() + ' · ' + loc + ' (' + Math.round(rect.width) + '×' + Math.round(rect.height) + ')',
      );
    }

    #hideLaser() {
      const box = this.shadowRoot.querySelector('.laser-box');
      const label = this.shadowRoot.querySelector('.laser-label');
      if (box) box.style.display = 'none';
      if (label) label.style.display = 'none';
      this.#hoveredEl = null;
      this.#hoveredWebGLNode = null;
    }

    #resetComposerToGlobal() {
      this.#pendingEl = document.body;
      this.#pendingWebGLNode = null;
      const meta = this.shadowRoot.querySelector('.pin-meta');
      meta.textContent = 'Alt+Click · Target DOM or 3D';
      meta.dataset.targeted = 'false';
      this.shadowRoot.querySelector('.btn-clear-target').hidden = true;
    }

    #openComposerFor(el, webglNode = null) {
      this.#pendingEl = el;
      this.#pendingWebGLNode = webglNode || null;
      const root = this.shadowRoot;
      const meta = root.querySelector('.pin-meta');
      if (this.#pendingWebGLNode) {
        const wn = this.#pendingWebGLNode;
        const posText = Array.isArray(wn.position)
          ? wn.position.map((v) => Number(v).toFixed(2)).join(', ')
          : '0, 0, 0';
        meta.textContent = 'webgl:' + wn.name + (wn.id ? '#' + wn.id : '') + ' · [' + posText + ']';
        meta.dataset.targeted = 'true';
        root.querySelector('.btn-clear-target').hidden = false;
      } else if (el === document.body) {
        this.#resetComposerToGlobal();
      } else {
        const radio = inspectElementRadio(el, '');
        if (radio) {
          meta.textContent = (radio.target.loc || radio.target.tag) + ' · ' + Math.round(radio.target.rect.width) + '×' + Math.round(radio.target.rect.height);
          meta.dataset.targeted = 'true';
        }
        root.querySelector('.btn-clear-target').hidden = false;
      }
      this.#setExpanded(true);
      setTimeout(() => root.querySelector('.pin-input').focus(), 140);
    }

    #clearSpotlight(restoreCss = true) {
      const root = this.shadowRoot;
      const backdrop = root.querySelector('.spotlight-backdrop');
      const box = root.querySelector('.spotlight-box');
      const card = root.querySelector('.spotlight-card');
      if (backdrop) backdrop.hidden = true;
      if (box) box.hidden = true;
      if (card) card.hidden = true;
      if (restoreCss && typeof this.#spotlightRestore === 'function') {
        try {
          this.#spotlightRestore();
        } catch {}
      }
      this.#spotlightRestore = null;
      this.#spotlightSpec = null;
      this.#spotlightDomEl = null;
      this.#spotlightWebGL = null;
    }

    showSpotlight(spec) {
      if (!spec || typeof spec !== 'object') return;
      this.#clearSpotlight(true);

      let matchedWebGL = null;
      let domEl = null;
      if (spec.target && typeof webglState.sceneGetter === 'function') {
        try {
          const nodes = webglState.sceneGetter() || [];
          for (let i = 0; i < nodes.length; i++) {
            const n = nodes[i];
            const fullTag = 'webgl:' + n.name + (n.id ? '#' + n.id : '');
            if (
              n.id === spec.target ||
              n.name === spec.target ||
              fullTag === spec.target ||
              ('webgl:' + n.name) === spec.target
            ) {
              matchedWebGL = n;
              break;
            }
          }
        } catch {}
      }
      if (!matchedWebGL && spec.target) {
        domEl = resolveElementByQuery({ selector: spec.target, loc: spec.target });
      }

      let rect = null;
      if (matchedWebGL && matchedWebGL.screenRect && matchedWebGL.screenRect.width > 0) {
        rect = matchedWebGL.screenRect;
      } else if (domEl) {
        const pre = domEl.getBoundingClientRect();
        if (pre.top < 12 || pre.bottom > window.innerHeight - 12) {
          domEl.scrollIntoView({ behavior: 'instant', block: 'nearest' });
        }
        rect = domEl.getBoundingClientRect();
      } else {
        rect = { left: Math.max(24, window.innerWidth - 360), top: 96, width: 0, height: 0, bottom: 96 };
      }

      if (domEl && spec.previewCss && typeof spec.previewCss === 'object') {
        const saved = [];
        const entries = Object.entries(spec.previewCss);
        for (let i = 0; i < entries.length; i++) {
          const rawProp = entries[i][0];
          const nextVal = entries[i][1];
          const cssProp = rawProp.replace(/([A-Z])/g, '-$1').toLowerCase();
          saved.push([
            cssProp,
            domEl.style.getPropertyValue(cssProp),
            domEl.style.getPropertyPriority(cssProp),
          ]);
          domEl.style.setProperty(cssProp, String(nextVal));
        }
        this.#spotlightRestore = () => {
          if (!domEl || !domEl.isConnected) return;
          for (let i = 0; i < saved.length; i++) {
            const item = saved[i];
            if (item[1]) domEl.style.setProperty(item[0], item[1], item[2]);
            else domEl.style.removeProperty(item[0]);
          }
        };
      }

      this.#spotlightSpec = spec;
      this.#spotlightDomEl = domEl;
      this.#spotlightWebGL = matchedWebGL;

      const variant = spec.variant === 'warning' || spec.variant === 'error' || spec.variant === 'preview'
        ? spec.variant
        : 'question';
      const badgeLabels = {
        question: 'QUESTION',
        warning: 'WARNING',
        error: 'BLOCKER',
        preview: 'CSS PREVIEW',
      };

      const root = this.shadowRoot;
      const backdrop = root.querySelector('.spotlight-backdrop');
      const box = root.querySelector('.spotlight-box');
      const card = root.querySelector('.spotlight-card');

      backdrop.hidden = false;

      if (rect.width > 0 && rect.height > 0) {
        box.dataset.variant = variant;
        box.style.left = (rect.left - 6) + 'px';
        box.style.top = (rect.top - 6) + 'px';
        box.style.width = (rect.width + 12) + 'px';
        box.style.height = (rect.height + 12) + 'px';
        box.hidden = false;
      } else {
        box.hidden = true;
      }

      card.dataset.variant = variant;
      card.querySelector('.spot-badge').textContent = spec.badge || badgeLabels[variant];
      card.querySelector('.spot-title').textContent = spec.title || (spec.target || 'Jolt Target');
      card.querySelector('.spot-msg').textContent = spec.message || '';

      const confirmBtn = card.querySelector('.spot-btn-confirm');
      const cancelBtn = card.querySelector('.spot-btn-cancel');
      confirmBtn.hidden = spec.confirmable === false;
      confirmBtn.textContent = spec.confirmLabel || '✓ Confirm';
      cancelBtn.textContent = spec.cancelLabel || '✕ Close';

      const cardW = Math.min(332, window.innerWidth - 24);
      const cardLeft = Math.max(12, Math.min(window.innerWidth - cardW - 12, rect.left));
      card.style.left = cardLeft + 'px';
      const rectBottom = rect.bottom ?? (rect.top + rect.height);
      if (rect.top > 185) {
        card.style.top = 'auto';
        card.style.bottom = (window.innerHeight - rect.top + 14) + 'px';
      } else {
        card.style.bottom = 'auto';
        card.style.top = Math.min(window.innerHeight - 175, Math.max(12, rectBottom + 14)) + 'px';
      }
      card.hidden = false;
    }

    appendAgentReply(payload) {
      if (!payload) return;
      const msg = payload.message || payload.reply || 'Patch applied';
      this.setAgentStatus(payload.status || 'done', msg);
      if (payload.spotlight && typeof payload.spotlight === 'object') {
        this.showSpotlight(payload.spotlight);
      }
    }

    setAgentStatus(status, message) {
      if (status === 'listening') {
        if (this.#workingTimer) {
          clearTimeout(this.#workingTimer);
          this.#workingTimer = null;
        }
        this.#internals.states.delete('working');
        this.#internals.states.add('listening');
        const listenMsg = message || 'Listening · Alt+Click or Stop';
        this.#agentStatus = { status: 'listening', message: listenMsg, expiresAt: 0 };
        this.#showToast(listenMsg, 4500);
        this.refreshView();
        return;
      }

      if (status === 'working') {
        if (message && message.indexOf('Sent to agent') !== -1 && Date.now() - this.#localPinAt < 1000) {
          return;
        }
        this.#internals.states.delete('listening');
        this.#pulseWorking(message || 'Agent working…', 45000);
        this.refreshView();
        return;
      }

      if (this.#workingTimer) {
        clearTimeout(this.#workingTimer);
        this.#workingTimer = null;
      }
      this.#internals.states.delete('working');
      this.#internals.states.delete('listening');

      if (message) {
        this.#agentStatus = { status: status || 'done', message, expiresAt: Date.now() + 4000 };
        this.#showToast(message, 3500);
        if (this.#lastPinnedRect) {
          this.#flashTarget(this.#lastPinnedRect);
        } else if (this.#lastPinnedEl && this.#lastPinnedEl.isConnected) {
          this.#flashTarget(this.#lastPinnedEl);
        }
      } else {
        this.#agentStatus = null;
      }
      this.refreshView();
    }

    setExpanded(open) {
      this.#setExpanded(!!open);
    }

    refreshView() {
      const gl = getWebGLSnapshot();
      const events = getFlightTimeline();
      const mocks = getNetworkMocks().filter((m) => m.active !== false);
      const errors = events.filter((e) => e.type === 'error' || e.type === 'console.error' || (e.type === 'fetch' && e.details && e.details.status >= 400));
      const hasError = errors.length > 0;

      if (hasError) {
        this.#internals.states.add('alert');
        const latestErr = errors[errors.length - 1];
        if (latestErr && latestErr.id !== this.#lastSeenErrorId) {
          this.#lastSeenErrorId = latestErr.id;
          this.#showToast(latestErr.summary, 4000);
        }
      } else {
        this.#internals.states.delete('alert');
      }

      if (mocks.length > 0) {
        this.#internals.states.add('mocking');
      } else {
        this.#internals.states.delete('mocking');
      }

      if (this.#agentStatus && this.#agentStatus.expiresAt > 0 && Date.now() > this.#agentStatus.expiresAt) {
        this.#agentStatus = null;
        this.#internals.states.delete('working');
      }

      if (!this.#expanded) return;

      const root = this.shadowRoot;
      const statusTagEl = root.querySelector('.status-tag');
      const statusTextEl = root.querySelector('.drawer-status-text');
      const isWorking = this.#internals.states.has('working');
      const isListening = this.#internals.states.has('listening');

      if (isWorking) {
        statusTagEl.textContent = 'BUSY';
      } else if (isListening) {
        statusTagEl.textContent = 'LIVE';
      } else if (this.#inspecting) {
        statusTagEl.textContent = 'SCAN';
      } else if (hasError) {
        statusTagEl.textContent = 'FAULT';
      } else if (mocks.length > 0) {
        statusTagEl.textContent = 'MOCK';
      } else {
        statusTagEl.textContent = 'NOMINAL';
      }

      if (this.#agentStatus) {
        statusTextEl.textContent = this.#agentStatus.message;
      } else if (hasError) {
        statusTextEl.textContent = errors.length + ' runtime error' + (errors.length > 1 ? 's' : '');
      } else if (this.#inspecting) {
        statusTextEl.textContent = 'Alt+Click DOM or WebGL';
      } else if (mocks.length > 0) {
        statusTextEl.textContent = 'Network mock active';
      } else {
        statusTextEl.textContent = 'Bridge Ready';
      }

      root.querySelector('.btn-stop-live').hidden = !(isListening || isWorking);
      root.querySelector('.btn-clear-alert').hidden = !hasError;

      const glEl = root.querySelector('.stat-webgl');
      glEl.textContent = gl ? (gl.fps + ' fps · ' + gl.drawCallsPerFrame + 'dc') : 'OFF';

      const storeEl = root.querySelector('.stat-stores');
      if (registeredStores.size === 0) {
        storeEl.textContent = '0 store';
      } else {
        const firstEntry = registeredStores.entries().next().value;
        const shortName = String(firstEntry[0]).replace(/Store$/i, '');
        let keyCount = 0;
        try {
          const st = typeof firstEntry[1].getState === 'function' ? firstEntry[1].getState() : firstEntry[1].state;
          if (st && typeof st === 'object') keyCount = Object.keys(st).length;
        } catch {}
        storeEl.textContent = keyCount > 0 ? (shortName + ' · ' + keyCount + 'k') : shortName;
      }

      const mockEl = root.querySelector('.stat-mocks');
      if (mocks.length > 0) {
        mockEl.textContent = mocks[0].status + ' MOCK' + (mocks.length > 1 ? ' +' + (mocks.length - 1) : '');
        mockEl.dataset.mock = 'true';
      } else {
        mockEl.textContent = '200 LIVE';
        mockEl.dataset.mock = 'false';
      }

      const signalText = root.querySelector('.signal-text');
      if (hasError) {
        const latestErr = errors[errors.length - 1];
        signalText.textContent = latestErr.summary + (latestErr.loc ? ' · ' + latestErr.loc : '');
      } else if (events.length > 0) {
        const lastEv = events[events.length - 1];
        signalText.textContent = '[' + lastEv.type + '] ' + lastEv.summary;
      } else {
        signalText.textContent = 'No runtime incidents';
      }
    }
  }

  function mountJoltHud() {
    if (!customElements.get('${JOLT_HUD_TAG}')) {
      customElements.define('${JOLT_HUD_TAG}', JoltHudElement);
    }
    const attach = () => {
      if (!document.body) return;
      if (!document.querySelector('${JOLT_HUD_TAG}')) {
        const hud = document.createElement('${JOLT_HUD_TAG}');
        document.body.append(hud);
      }
    };
    if (document.body) attach();
    else window.addEventListener('DOMContentLoaded', attach, { once: true });
  }

  function notifyHudUpdate() {
    const hud = document.querySelector('${JOLT_HUD_TAG}');
    if (hud && typeof hud.refreshView === 'function') {
      hud.refreshView();
    }
  }

  function setHudAgentStatus(status, message) {
    const hud = document.querySelector('${JOLT_HUD_TAG}');
    if (hud && typeof hud.setAgentStatus === 'function') {
      hud.setAgentStatus(status, message);
    }
  }

  function handleHudAgentReply(payload) {
    const hud = document.querySelector('${JOLT_HUD_TAG}');
    if (hud && typeof hud.appendAgentReply === 'function') {
      hud.appendAgentReply(payload);
    }
  }
`;
}
