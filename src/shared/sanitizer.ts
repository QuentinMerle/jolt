import { JOLT_LIMITS, SENSITIVE_KEY_PATTERN } from './constants.ts';
import type { FlightEvent } from './types.ts';

const REDACTED_VALUE = '[REDACTED]';
const MAX_SANITIZE_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;

/**
 * Recursively redacts sensitive keys, guards against circular references,
 * and caps string lengths to keep Jolt payloads safe and token-light.
 */
export function sanitizePayload(
  input: unknown,
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (input === null || input === undefined) {
    return input;
  }

  if (typeof input === 'string') {
    if (input.length <= JOLT_LIMITS.MAX_STRING_LEN) {
      return input;
    }
    return `${input.slice(0, JOLT_LIMITS.MAX_STRING_LEN)}…`;
  }

  if (typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }

  if (typeof input !== 'object') {
    return String(input).slice(0, JOLT_LIMITS.MAX_STRING_LEN);
  }

  if (depth >= MAX_SANITIZE_DEPTH) {
    return '[MaxDepth]';
  }

  if (seen.has(input)) {
    return '[Circular]';
  }
  seen.add(input);

  if (Array.isArray(input)) {
    return input.slice(0, MAX_ARRAY_ITEMS).map((item) => sanitizePayload(item, depth + 1, seen));
  }

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      out[key] = REDACTED_VALUE;
      continue;
    }
    out[key] = sanitizePayload(value, depth + 1, seen);
  }
  return out;
}

/**
 * Normalizes Flight Recorder timestamps relative to the latest event (or refTime)
 * so agents see causal offsets (e.g., -450ms, 0ms).
 */
export function formatRelativeTimeline(
  events: readonly FlightEvent[],
  refTime?: number,
): FlightEvent[] {
  if (events.length === 0) {
    return [];
  }

  const anchor = refTime ?? events[events.length - 1].timestamp;
  return events.map((event) => ({
    ...event,
    relativeMs: Math.round(event.timestamp - anchor),
  }));
}
