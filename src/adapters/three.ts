import { getJoltBridge } from './shared.ts';

/** Structural Three.js Vector3 / Matrix4 / Object3D / Scene contracts (zero Three.js runtime import). */
export interface ThreeVector3Like {
  x: number;
  y: number;
  z: number;
  set?: (x: number, y: number, z: number) => void;
}

export interface ThreeMatrix4Like {
  elements: ArrayLike<number>;
}

export interface ThreeCameraLike {
  matrixWorldInverse?: ThreeMatrix4Like;
  projectionMatrix?: ThreeMatrix4Like;
  updateMatrixWorld?: (force?: boolean) => void;
}

export interface ThreeObject3DLike {
  uuid?: string;
  name?: string;
  type?: string;
  visible?: boolean;
  isMesh?: boolean;
  isObject3D?: boolean;
  position: ThreeVector3Like;
  scale?: ThreeVector3Like;
  userData?: Record<string, unknown>;
  material?: { color?: { getHexString?: () => string; set?: (v: unknown) => void } } | Array<unknown>;
  geometry?: { boundingSphere?: { radius?: number } | null; computeBoundingSphere?: () => void };
  getWorldPosition?: (target: ThreeVector3Like) => ThreeVector3Like;
}

export interface ThreeSceneLike {
  traverse: (callback: (obj: ThreeObject3DLike) => void) => void;
  updateMatrixWorld?: (force?: boolean) => void;
}

export interface JoltThreeOptions {
  /** DOM element or canvas used for viewport screenRect projection (defaults to document `<canvas>`). */
  domElement?: { getBoundingClientRect: () => { left: number; top: number; width: number; height: number } } | null;
  /** Optional custom name for the companion control store (`false` disables store registration). */
  storeName?: string | false;
  /** Include objects without an explicit `name` (defaults to false, always includes `userData.joltId` meshes). */
  includeUnnamed?: boolean;
  /** Maximum number of scene nodes exposed per digest snapshot (default 15). */
  maxNodes?: number;
}

/** Projects a 3D world point through column-major view + projection 4x4 matrices into NDC `[x, y, z]`. */
function projectPointToNdc(
  worldPos: ThreeVector3Like,
  viewMat: ArrayLike<number>,
  projMat: ArrayLike<number>,
): [number, number, number] | null {
  const vx = viewMat[0] * worldPos.x + viewMat[4] * worldPos.y + viewMat[8] * worldPos.z + viewMat[12];
  const vy = viewMat[1] * worldPos.x + viewMat[5] * worldPos.y + viewMat[9] * worldPos.z + viewMat[13];
  const vz = viewMat[2] * worldPos.x + viewMat[6] * worldPos.y + viewMat[10] * worldPos.z + viewMat[14];
  const vw = viewMat[3] * worldPos.x + viewMat[7] * worldPos.y + viewMat[11] * worldPos.z + viewMat[15];

  const cx = projMat[0] * vx + projMat[4] * vy + projMat[8] * vz + projMat[12] * vw;
  const cy = projMat[1] * vx + projMat[5] * vy + projMat[9] * vz + projMat[13] * vw;
  const cz = projMat[2] * vx + projMat[6] * vy + projMat[10] * vz + projMat[14] * vw;
  const cw = projMat[3] * vx + projMat[7] * vy + projMat[11] * vz + projMat[15] * vw;

  if (Math.abs(cw) < 1e-6) return null;
  return [cx / cw, cy / cw, cz / cw];
}

function getViewportRect(options: JoltThreeOptions): { left: number; top: number; width: number; height: number } {
  if (options.domElement && typeof options.domElement.getBoundingClientRect === 'function') {
    return options.domElement.getBoundingClientRect();
  }
  const doc = (globalThis as { document?: Document }).document;
  const canvas = doc?.querySelector?.('canvas');
  if (canvas) {
    return canvas.getBoundingClientRect();
  }
  const win = globalThis as { innerWidth?: number; innerHeight?: number };
  return { left: 0, top: 0, width: win.innerWidth || 1280, height: win.innerHeight || 720 };
}

/**
 * Connects any Three.js or React Three Fiber (`THREE.Scene` + `THREE.Camera`) runtime to Jolt:
 * - Auto-projects named 3D meshes into 2D `screenRect` boxes for `Alt+Hover` / `Alt+Click` 3D picking.
 * - Registers companion store actions (`setNodePosition`, `setNodeScale`, `setNodeVisible`) for AI control.
 * Safe no-op in production builds (`window.__JOLT__` absent).
 */
export function joltThree(
  scene: ThreeSceneLike,
  camera: ThreeCameraLike,
  options: JoltThreeOptions = {},
): () => void {
  const bridge = getJoltBridge();
  if (!bridge || !scene || typeof scene.traverse !== 'function' || !camera) {
    return () => {};
  }

  const includeUnnamed = options.includeUnnamed === true;
  const maxNodes = options.maxNodes ?? 15;
  const nodeIndex = new Map<string, ThreeObject3DLike>();

  const collectNodes = () => {
    scene.updateMatrixWorld?.(true);
    camera.updateMatrixWorld?.(true);

    const viewMat = camera.matrixWorldInverse?.elements;
    const projMat = camera.projectionMatrix?.elements;
    const rect = getViewportRect(options);
    const out: Array<Record<string, unknown>> = [];
    nodeIndex.clear();

    scene.traverse((obj) => {
      if (out.length >= maxNodes) return;
      if (obj.visible === false) return;
      const explicitId = typeof obj.userData?.joltId === 'string' ? obj.userData.joltId : undefined;
      const objName = obj.name?.trim();
      const isMeshLike = obj.isMesh === true || obj.type === 'Mesh' || obj.type === 'Group';
      if (!isMeshLike && !explicitId) return;
      if (!objName && !explicitId && !includeUnnamed) return;

      const id = explicitId || objName || obj.uuid || `node_${out.length + 1}`;
      nodeIndex.set(id, obj);

      const pos = { x: obj.position?.x ?? 0, y: obj.position?.y ?? 0, z: obj.position?.z ?? 0 };
      if (typeof obj.getWorldPosition === 'function') {
        obj.getWorldPosition(pos);
      }

      let screenRect: { x: number; y: number; width: number; height: number } | undefined;
      if (viewMat && projMat && rect.width > 0 && rect.height > 0) {
        const ndc = projectPointToNdc(pos, viewMat, projMat);
        if (ndc && ndc[2] >= -1 && ndc[2] <= 1) {
          const sx = rect.left + ((ndc[0] + 1) * 0.5) * rect.width;
          const sy = rect.top + ((1 - ndc[1]) * 0.5) * rect.height;
          if (obj.geometry && !obj.geometry.boundingSphere && typeof obj.geometry.computeBoundingSphere === 'function') {
            obj.geometry.computeBoundingSphere();
          }
          const radius = obj.geometry?.boundingSphere?.radius ?? 0.8;
          const edgePos = { x: pos.x + radius * (obj.scale?.x ?? 1), y: pos.y, z: pos.z };
          const edgeNdc = projectPointToNdc(edgePos, viewMat, projMat);
          const halfPx = edgeNdc
            ? Math.max(24, Math.min(180, Math.abs(edgeNdc[0] - ndc[0]) * 0.5 * rect.width))
            : 48;
          screenRect = {
            x: Math.round(sx - halfPx),
            y: Math.round(sy - halfPx),
            width: Math.round(halfPx * 2),
            height: Math.round(halfPx * 2),
          };
        }
      }

      const colorHex =
        obj.material && !Array.isArray(obj.material) && typeof obj.material.color?.getHexString === 'function'
          ? `#${obj.material.color.getHexString()}`
          : undefined;

      out.push({
        id,
        name: objName || id,
        type: obj.type || 'Mesh',
        position: [Number(pos.x.toFixed(2)), Number(pos.y.toFixed(2)), Number(pos.z.toFixed(2))],
        scale: Number((obj.scale?.x ?? 1).toFixed(2)),
        visible: obj.visible !== false,
        ...(colorHex ? { color: colorHex } : {}),
        ...(typeof obj.userData?.joltLoc === 'string' ? { loc: obj.userData.joltLoc } : {}),
        ...(screenRect ? { screenRect } : {}),
      });
    });

    return out;
  };

  bridge.registerScene(collectNodes);

  let unregisterStore = () => {};
  if (options.storeName !== false) {
    const storeName = options.storeName || 'joltThreeScene';
    const findNode = (key: unknown): ThreeObject3DLike | undefined => {
      if (typeof key !== 'string') return undefined;
      return nodeIndex.get(key) ?? (() => {
        collectNodes();
        return nodeIndex.get(key);
      })();
    };

    unregisterStore = bridge.registerStore(storeName, {
      getState: () => ({ nodes: collectNodes() }),
      actions: {
        setNodePosition: (payload: unknown) => {
          const p = payload as { id?: string; position?: number[]; x?: number; y?: number; z?: number };
          const node = findNode(p?.id);
          if (!node) return { ok: false, error: `Three node not found: ${String(p?.id)}` };
          const nx = Array.isArray(p.position) ? Number(p.position[0]) : (p.x ?? node.position.x);
          const ny = Array.isArray(p.position) ? Number(p.position[1]) : (p.y ?? node.position.y);
          const nz = Array.isArray(p.position) ? Number(p.position[2]) : (p.z ?? node.position.z);
          if (typeof node.position.set === 'function') node.position.set(nx, ny, nz);
          else {
            node.position.x = nx;
            node.position.y = ny;
            node.position.z = nz;
          }
          bridge.recordStoreEvent?.(`three:${p.id}.position`, { position: [nx, ny, nz] });
          return { ok: true, id: p.id, position: [nx, ny, nz] };
        },
        setNodeScale: (payload: unknown) => {
          const p = payload as { id?: string; scale?: number };
          const node = findNode(p?.id);
          if (!node || !node.scale || typeof p?.scale !== 'number') {
            return { ok: false, error: `Invalid scale payload for: ${String(p?.id)}` };
          }
          if (typeof node.scale.set === 'function') node.scale.set(p.scale, p.scale, p.scale);
          else {
            node.scale.x = p.scale;
            node.scale.y = p.scale;
            node.scale.z = p.scale;
          }
          bridge.recordStoreEvent?.(`three:${p.id}.scale`, { scale: p.scale });
          return { ok: true, id: p.id, scale: p.scale };
        },
        setNodeVisible: (payload: unknown) => {
          const p = payload as { id?: string; visible?: boolean };
          const node = findNode(p?.id);
          if (!node || typeof p?.visible !== 'boolean') {
            return { ok: false, error: `Invalid visibility payload for: ${String(p?.id)}` };
          }
          node.visible = p.visible;
          bridge.recordStoreEvent?.(`three:${p.id}.visible`, { visible: p.visible });
          return { ok: true, id: p.id, visible: p.visible };
        },
      },
    });
  }

  return () => {
    unregisterStore();
    bridge.registerScene(() => []);
  };
}
