/** Categories of causal events captured in the browser Flight Recorder ring buffer. */
export type FlightEventType = 'click' | 'error' | 'console.error' | 'fetch' | 'store' | 'mock';

/** Single causal event captured in the browser timeline. */
export interface FlightEvent {
  id: string;
  type: FlightEventType;
  timestamp: number;
  relativeMs: number;
  summary: string;
  loc?: string;
  details?: Record<string, unknown>;
}

/** Compact accessibility node extracted on demand without layout thrashing. */
export interface A11yCompactNode {
  role: string;
  name: string;
  loc?: string;
  refId?: string;
  value?: string;
  locked?: boolean;
}

/** Bounding box and layout-critical computed CSS snapshot for an inspected node. */
export interface CssRadioBox {
  tag: string;
  loc?: string;
  rect: { x: number; y: number; width: number; height: number };
  styles: Record<string, string>;
}

/** Element pinned via Alt+Click in the browser HUD for surgical agent targeting. */
export interface PinnedElement {
  id: string;
  timestamp: number;
  note: string;
  target: CssRadioBox;
  parent: CssRadioBox | null;
  componentChain?: string[];
}

/** Simplified 3D scene node exposed by the WebGL/R3F bridge. */
export interface WebGLSceneNode {
  name: string;
  type: string;
  position?: [number, number, number];
  visible?: boolean;
}

/** Real-time WebGL / WebGL2 GPU telemetry snapshot. */
export interface WebGLMetrics {
  active: boolean;
  contextType: 'webgl2' | 'webgl' | null;
  fps: number;
  fps1Low: number;
  drawCallsPerFrame: number;
  trianglesPerFrame: number;
  programs: number;
  textures: number;
  buffers: number;
  canvasSize: { width: number; height: number };
  sceneNodes: WebGLSceneNode[];
}

/** Active client-side fetch interception rule controlled via MCP or HUD. */
export interface NetworkMockRule {
  id: string;
  urlPattern: string;
  method?: string;
  status: number;
  delayMs?: number;
  responseBody: unknown;
  active: boolean;
  hitCount: number;
}

/** Compilation or transform error captured directly on the Vite/Node server. */
export interface CompileErrorInfo {
  message: string;
  file?: string;
  line?: number;
  column?: number;
  frame?: string;
}

/** Real-time viewport dimensions and responsive overflow signal. */
export interface ViewportMetrics {
  width: number;
  height: number;
  devicePixelRatio: number;
  horizontalOverflow: boolean;
  scrollY: number;
}

/** Unified white-box state digest returned to AI agents in < 250 tokens target. */
export interface JoltDigest {
  timestamp: number;
  url: string;
  port: number;
  healthy: boolean;
  compileError: CompileErrorInfo | null;
  pinnedElements: PinnedElement[];
  flightRecorder: FlightEvent[];
  stores: Record<string, unknown>;
  webgl: WebGLMetrics | null;
  viewport?: ViewportMetrics | null;
  activeMocks: NetworkMockRule[];
  a11yTree: A11yCompactNode[];
}

/** Entry persisted in /tmp/jolt-sessions.json for port auto-discovery. */
export interface JoltSessionEntry {
  port: number;
  url: string;
  pid: number;
  root: string;
  token: string;
  updatedAt: number;
}

/** Configuration options for vitePluginJolt. */
export interface JoltPluginOptions {
  enabled?: boolean;
  rootDir?: string;
  joltDir?: string;
  webgl?: boolean | { pick3D?: boolean };
  networkMocks?: boolean;
}
