/** JSON Schema definition for a Jolt MCP tool. */
export interface ToolSchema {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/** Minimal 4-tool MCP surface optimized for both Cloud LLMs and local SLMs (oMLX). */
export const JOLT_MCP_TOOLS: ToolSchema[] = [
  {
    name: 'jolt_get_digest',
    description:
      'Retrieves the compact white-box digest (< 250 tokens target) from the running app: Vite compile errors, 10-event causal Flight Recorder, Alt+Click pinned elements, store states, WebGL GPU telemetry, active fetch mocks, and compact A11y tree.',
    inputSchema: {
      type: 'object',
      properties: {
        port: {
          type: 'number',
          description: 'Optional dev server port. Auto-discovered from /tmp/jolt-sessions.json when omitted.',
        },
        includeA11y: {
          type: 'boolean',
          default: true,
          description: 'Include compact interactive A11y nodes in the digest.',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'jolt_inspect_element',
    description:
      'Inspects a specific DOM element (by CSS selector or data-jolt-loc) or returns the latest Alt+Click pinned element with exact file:line:col coordinate, bounding rect, and comparative Child + Parent layout CSS.',
    inputSchema: {
      type: 'object',
      properties: {
        selector: {
          type: 'string',
          description: 'CSS selector of the element to inspect in the live browser.',
        },
        loc: {
          type: 'string',
          description: 'Exact data-jolt-loc coordinate (e.g. "playground/index.html:42:5").',
        },
        pinnedIndex: {
          type: 'number',
          description: 'Index of an Alt+Click pinned element when selector and loc are omitted (default 0 = latest).',
        },
        port: { type: 'number' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'jolt_mutate_runtime',
    description:
      'Mutates a registered front-end store action/state, triggers a click on a data-jolt-loc/selector, or clears storage, then returns the refreshed digest after 60ms.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['store_action', 'store_set', 'click_element', 'clear_storage', 'clear_pins'],
        },
        target: {
          type: 'string',
          description: 'Store name, CSS selector, or data-jolt-loc depending on operation.',
        },
        action: {
          type: 'string',
          description: 'Registered store action name when operation is "store_action".',
        },
        payload: {
          description: 'Argument passed to store_action or partial state object for store_set.',
        },
        port: { type: 'number' },
      },
      required: ['operation'],
      additionalProperties: false,
    },
  },
  {
    name: 'jolt_mock_network',
    description:
      'Manages client-side window.fetch mock rules in real time (e.g. simulate HTTP 500 error, latency, or custom JSON body without touching the backend).',
    inputSchema: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['add', 'remove', 'clear', 'list'],
        },
        urlPattern: {
          type: 'string',
          description: 'Substring or regex pattern matched against fetch URLs (e.g. "/api/checkout").',
        },
        method: {
          type: 'string',
          description: 'Optional HTTP method filter (e.g. "POST").',
        },
        status: {
          type: 'number',
          description: 'HTTP status code to return (e.g. 500, 404, 429).',
        },
        delayMs: {
          type: 'number',
          description: 'Optional artificial latency in milliseconds before returning the mocked response.',
        },
        responseBody: {
          description: 'JSON payload returned in the mocked Response.',
        },
        ruleId: {
          type: 'string',
          description: 'Rule ID used when action is "remove".',
        },
        port: { type: 'number' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  },
  {
    name: 'jolt_spotlight',
    description:
      'Highlights a DOM element or WebGL2 3D node directly in the browser with an interactive guidance card and optional in-memory CSS preview.',
    inputSchema: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'CSS selector, data-jolt-loc coordinate, or 3D node id/name (e.g. "#btn-checkout" or "OrbitalTorus").',
        },
        variant: {
          type: 'string',
          enum: ['question', 'warning', 'error', 'preview'],
          default: 'question',
        },
        title: { type: 'string' },
        message: { type: 'string' },
        previewCss: {
          type: 'object',
          description: 'Temporary in-memory CSS properties previewed on DOM targets before writing to disk.',
        },
        confirmable: { type: 'boolean', default: true },
        confirmLabel: { type: 'string' },
        cancelLabel: { type: 'string' },
        keepPreviewOnConfirm: { type: 'boolean', default: true },
        notifyOnCancel: { type: 'boolean', default: false },
        port: { type: 'number' },
      },
      required: ['target', 'message'],
      additionalProperties: false,
    },
  },
];
