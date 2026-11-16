/** HTTP endpoints exposed by Jolt on the Vite or standalone dev server. */
export const JOLT_ROUTES = {
  DIGEST: '/__jolt/digest',
  INSPECT: '/__jolt/inspect',
  RPC: '/__jolt/rpc',
  MOCK: '/__jolt/mock',
  EVENTS: '/__jolt/events',
  CLIENT_REPORT: '/__jolt/report',
  WAIT_PIN: '/__jolt/wait-pin',
  STATUS: '/__jolt/status',
  SPOTLIGHT: '/__jolt/spotlight',
  PROBE_SCRIPT: '/@jolt/probe.js',
} as const;

/** Hard bounds keeping Jolt payloads compact (< 250 tokens target) and low-overhead. */
export const JOLT_LIMITS = {
  MAX_FLIGHT_EVENTS: 10,
  MAX_A11Y_NODES: 50,
  MAX_PINNED_ELEMENTS: 5,
  MAX_STRING_LEN: 120,
  PULL_TIMEOUT_MS: 250,
} as const;

/** Layout-governing CSS properties extracted for Child + Parent comparative inspection. */
export const RADIO_CSS_PROPS = [
  'display',
  'position',
  'flexDirection',
  'justifyContent',
  'alignItems',
  'flexWrap',
  'flexShrink',
  'gap',
  'gridTemplateColumns',
  'overflow',
  'overflowX',
  'overflowY',
  'zIndex',
  'width',
  'height',
  'padding',
  'margin',
] as const;

/** Pattern matching keys whose values must be redacted before leaving the browser/server. */
export const SENSITIVE_KEY_PATTERN = /password|secret|token|apikey|api_key|authorization|cookie|session/i;

/** Local registry tracking active Jolt dev servers across ports for MCP auto-discovery. */
export const SESSIONS_FILE_PATH = '/tmp/jolt-sessions.json';

/** Custom element tag name for the floating Shadow DOM HUD. */
export const JOLT_HUD_TAG = 'jolt-hud';

/** Source-mapping HTML attribute injected at serve-time. */
export const JOLT_LOC_ATTR = 'data-jolt-loc';

/** Opt-out attribute preventing Jolt from recording or exposing sensitive DOM nodes. */
export const JOLT_IGNORE_ATTR = 'data-jolt-ignore';
