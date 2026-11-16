import { JOLT_HUD_TAG, JOLT_LIMITS, JOLT_LOC_ATTR } from '../shared/constants.ts';

/**
 * Generates the browser-side Flight Recorder ring buffer script.
 * Captures the last 10 causal events (clicks with data-jolt-loc, runtime errors, console.error)
 * with zero MutationObserver or layout thrashing overhead.
 */
export function buildFlightRecorderScript(): string {
  return `
  const MAX_FLIGHT = ${JOLT_LIMITS.MAX_FLIGHT_EVENTS};
  const flightBuffer = [];
  let eventSeq = 0;
  let joltLaserActive = false;

  function findNearestLoc(node) {
    if (!node || typeof node.closest !== 'function') return undefined;
    const match = node.closest('[${JOLT_LOC_ATTR}]');
    return match ? match.getAttribute('${JOLT_LOC_ATTR}') || undefined : undefined;
  }

  function isFromJoltHud(event) {
    if (typeof event.composedPath === 'function') {
      const path = event.composedPath();
      for (let i = 0; i < path.length; i++) {
        const item = path[i];
        if (item && item.tagName && item.tagName.toLowerCase() === '${JOLT_HUD_TAG}') {
          return true;
        }
      }
    }
    const target = event.target;
    return !!(target && target.closest && target.closest('${JOLT_HUD_TAG}'));
  }

  function pushFlightEvent(type, summary, loc, details) {
    const entry = {
      id: 'ev_' + (++eventSeq),
      type,
      timestamp: Date.now(),
      relativeMs: 0,
      summary: String(summary || '').slice(0, ${JOLT_LIMITS.MAX_STRING_LEN}),
      ...(loc ? { loc } : {}),
      ...(details ? { details } : {}),
    };
    flightBuffer.push(entry);
    if (flightBuffer.length > MAX_FLIGHT) {
      flightBuffer.shift();
    }
    notifyHudUpdate();
    if (type === 'error') {
      scheduleBackgroundReport('runtime-error');
    }
    return entry;
  }

  function getFlightTimeline() {
    if (flightBuffer.length === 0) return [];
    const anchor = flightBuffer[flightBuffer.length - 1].timestamp;
    return flightBuffer.map((ev) => ({
      ...ev,
      relativeMs: Math.round(ev.timestamp - anchor),
    }));
  }

  window.addEventListener('click', (event) => {
    if (joltLaserActive || isFromJoltHud(event)) return;
    const el = event.target instanceof Element ? event.target : null;
    if (!el) return;
    const loc = findNearestLoc(el);
    const label = (el.getAttribute('aria-label') || el.textContent || el.tagName.toLowerCase())
      .trim()
      .replace(/\\s+/g, ' ')
      .slice(0, 48);
    pushFlightEvent('click', '<' + el.tagName.toLowerCase() + '> "' + label + '"', loc);
  }, { capture: true, passive: true });

  window.addEventListener('error', (event) => {
    const loc = event.filename
      ? event.filename.replace(window.location.origin + '/', '') + ':' + event.lineno + ':' + event.colno
      : undefined;
    pushFlightEvent('error', event.message || 'Uncaught error', loc, {
      stack: event.error && event.error.stack ? String(event.error.stack).split('\\n').slice(0, 3).join(' | ') : undefined,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error ? event.reason.message : String(event.reason);
    pushFlightEvent('error', 'UnhandledRejection: ' + reason, undefined);
  });

  const origConsoleError = console.error.bind(console);
  console.error = (...args) => {
    origConsoleError(...args);
    const message = args
      .map((arg) => {
        if (arg instanceof Error) return arg.message;
        if (typeof arg === 'object' && arg !== null) {
          try { return JSON.stringify(arg); } catch { return String(arg); }
        }
        return String(arg);
      })
      .join(' ');
    if (message.includes('[Jolt]')) return;
    pushFlightEvent('console.error', message, undefined);
  };
`;
}
