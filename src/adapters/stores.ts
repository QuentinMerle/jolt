import { getJoltBridge, splitStateAndActions } from './shared.ts';

/** Structural Zustand store contract (vanilla `createStore` or React `create` hook). */
export interface ZustandStoreLike<T extends Record<string, unknown> = Record<string, unknown>> {
  getState: () => T;
  setState: (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}

/** Structural Vue 3 Pinia store contract. */
export interface PiniaStoreLike<T extends Record<string, unknown> = Record<string, unknown>> {
  $id: string;
  $state: T;
  $patch: (partial: Partial<T>) => void;
  $subscribe?: (callback: (mutation: { type?: string; storeId?: string }, state: T) => void) => () => void;
  [key: string]: unknown;
}

/** Structural Vue 3 Pinia root instance (`createPinia()`). */
export interface PiniaInstanceLike {
  _s?: Map<string, PiniaStoreLike>;
}

/** Structural Redux / RTK store contract. */
export interface ReduxStoreLike<T = unknown> {
  getState: () => T;
  dispatch: (action: { type: string; [key: string]: unknown }) => unknown;
  subscribe: (listener: () => void) => () => void;
}

/**
 * Connects a Zustand store (`create` / `createStore`) to Jolt in 1 line.
 * Automatically separates serializable state keys from callable store actions
 * and records updates into the causal Flight Recorder. No-op in production.
 */
export function joltZustand<T extends Record<string, unknown>>(
  name: string,
  store: ZustandStoreLike<T>,
): () => void {
  const bridge = getJoltBridge();
  if (!bridge || !store || typeof store.getState !== 'function') {
    return () => {};
  }

  const getCleanActions = () => splitStateAndActions(store.getState()).actions;
  const unregister = bridge.registerStore(name, {
    getState: () => splitStateAndActions(store.getState()).state,
    setState: (partial) => store.setState(partial as Partial<T>),
    actions: getCleanActions(),
  });

  const unsubscribe =
    typeof store.subscribe === 'function'
      ? store.subscribe(() => {
          bridge.recordStoreEvent?.(`${name} updated`);
        })
      : () => {};

  return () => {
    unsubscribe();
    unregister();
  };
}

/** Connects an individual Vue 3 Pinia store (`useCartStore()`) to Jolt. */
export function joltPiniaStore<T extends Record<string, unknown>>(
  store: PiniaStoreLike<T>,
  nameOverride?: string,
): () => void {
  const bridge = getJoltBridge();
  if (!bridge || !store || typeof store.$state !== 'object') {
    return () => {};
  }

  const name = nameOverride || store.$id || 'piniaStore';
  const reserved = new Set<string>(Object.keys(store.$state || {}));
  const { actions } = splitStateAndActions(store, reserved);

  const unregister = bridge.registerStore(name, {
    getState: () => ({ ...store.$state }),
    setState: (partial) => store.$patch(partial as Partial<T>),
    actions,
  });

  const unsubscribe =
    typeof store.$subscribe === 'function'
      ? store.$subscribe((mutation) => {
          bridge.recordStoreEvent?.(`${name} (${mutation?.type || 'patch'})`);
        })
      : () => {};

  return () => {
    unsubscribe();
    unregister();
  };
}

/**
 * Connects all active stores registered on a Vue 3 Pinia instance (`createPinia()`).
 * Returns a single cleanup function unbinding every registered store.
 */
export function joltPinia(pinia: PiniaInstanceLike): () => void {
  const bridge = getJoltBridge();
  if (!bridge || !pinia || !(pinia._s instanceof Map)) {
    return () => {};
  }

  const cleanups: Array<() => void> = [];
  for (const [id, store] of pinia._s.entries()) {
    cleanups.push(joltPiniaStore(store, id));
  }

  return () => {
    for (const stop of cleanups) stop();
  };
}

/**
 * Connects a Redux / Redux Toolkit store to Jolt.
 * Optionally maps action creators so the agent can trigger `store_action` directly.
 */
export function joltRedux<T = unknown>(
  name: string,
  store: ReduxStoreLike<T>,
  actionCreators: Record<string, (...args: unknown[]) => { type: string; [key: string]: unknown }> = {},
): () => void {
  const bridge = getJoltBridge();
  if (!bridge || !store || typeof store.getState !== 'function' || typeof store.dispatch !== 'function') {
    return () => {};
  }

  const wrappedActions: Record<string, (...args: unknown[]) => unknown> = {
    dispatch: (action: unknown) => {
      if (action && typeof action === 'object' && 'type' in action) {
        return store.dispatch(action as { type: string });
      }
      return { ok: false, error: 'Invalid Redux action object' };
    },
  };

  for (const [actionName, creator] of Object.entries(actionCreators)) {
    if (typeof creator === 'function') {
      wrappedActions[actionName] = (...args: unknown[]) => store.dispatch(creator(...args));
    }
  }

  const unregister = bridge.registerStore(name, {
    getState: () => store.getState(),
    setState: (partial) => {
      store.dispatch({ type: '@@JOLT/PATCH', payload: partial });
    },
    actions: wrappedActions,
  });

  const unsubscribe =
    typeof store.subscribe === 'function'
      ? store.subscribe(() => {
          bridge.recordStoreEvent?.(`${name} dispatched`);
        })
      : () => {};

  return () => {
    unsubscribe();
    unregister();
  };
}
