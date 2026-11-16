/** Minimal structural contract for `window.__JOLT__` client bridge. */
export interface JoltStoreRegistration {
  getState: () => unknown;
  setState?: (partial: Record<string, unknown>) => void;
  actions?: Record<string, (...args: unknown[]) => unknown>;
}

export interface JoltGlobalBridge {
  registerStore: (name: string, config: JoltStoreRegistration) => () => void;
  registerScene: (getter: () => unknown[]) => void;
  recordStoreEvent?: (summary: string, details?: Record<string, unknown>) => void;
}

/** Resolves `window.__JOLT__` safely in both browser and SSR/Node environments. */
export function getJoltBridge(): JoltGlobalBridge | null {
  const g = globalThis as { window?: { __JOLT__?: JoltGlobalBridge }; __JOLT__?: JoltGlobalBridge };
  const candidate = g.window?.__JOLT__ ?? g.__JOLT__;
  if (!candidate || typeof candidate.registerStore !== 'function') {
    return null;
  }
  return candidate;
}

/** Splits an object (like Zustand state or a Pinia store) into serializable state keys and callable actions. */
export function splitStateAndActions(
  source: Record<string, unknown> | null | undefined,
  reservedKeys: ReadonlySet<string> = new Set(),
): { state: Record<string, unknown>; actions: Record<string, (...args: unknown[]) => unknown> } {
  const state: Record<string, unknown> = {};
  const actions: Record<string, (...args: unknown[]) => unknown> = {};
  if (!source || typeof source !== 'object') {
    return { state, actions };
  }

  for (const key of Object.keys(source)) {
    if (key.startsWith('$') || key.startsWith('_') || reservedKeys.has(key)) continue;
    const value = source[key];
    if (typeof value === 'function') {
      actions[key] = (...args: unknown[]) => (value as (...a: unknown[]) => unknown).apply(source, args);
    } else {
      state[key] = value;
    }
  }
  return { state, actions };
}
