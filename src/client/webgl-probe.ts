/**
 * Generates the passive WebGL / WebGL2 telemetry probe.
 * Uses zero per-frame object allocations and a fixed Float64Array ring for FPS / 1% low
 * to preserve ProMotion 60Hz/120Hz fluidity on Apple Silicon / Safari ANGLE.
 */
export function buildWebGLProbeScript(
  options: { enabled?: boolean; pick3D?: boolean } = {},
): string {
  const webglEnabled = options.enabled !== false;
  const pick3DEnabled = options.pick3D !== false;

  return `
  const webglState = {
    enabled: ${webglEnabled},
    pick3D: ${pick3DEnabled},
    active: false,
    contextType: null,
    canvas: null,
    programs: 0,
    textures: 0,
    buffers: 0,
    currentDrawCalls: 0,
    currentTriangles: 0,
    lastFrameDrawCalls: 0,
    lastFrameTriangles: 0,
    fps: 0,
    fps1Low: 0,
    sceneGetter: null,
  };

  const FRAME_WINDOW = 60;
  const frameTimes = new Float64Array(FRAME_WINDOW);
  let frameWriteIdx = 0;
  let frameSampleCount = 0;
  let lastRafTs = 0;
  let rafStarted = false;

  function estimateTriangles(mode, count) {
    // 4=TRIANGLES, 5=TRIANGLE_STRIP, 6=TRIANGLE_FAN
    if (mode === 4) return (count / 3) | 0;
    if (mode === 5 || mode === 6) return count >= 3 ? count - 2 : 0;
    return 0;
  }

  function startFrameMonitor() {
    if (rafStarted) return;
    rafStarted = true;
    const tick = (now) => {
      if (lastRafTs > 0) {
        const dt = now - lastRafTs;
        if (dt > 0 && dt < 1000) {
          frameTimes[frameWriteIdx] = dt;
          frameWriteIdx = (frameWriteIdx + 1) % FRAME_WINDOW;
          if (frameSampleCount < FRAME_WINDOW) frameSampleCount++;

          if (frameSampleCount >= 5) {
            let sum = 0;
            let maxDt = 0;
            for (let i = 0; i < frameSampleCount; i++) {
              const v = frameTimes[i];
              sum += v;
              if (v > maxDt) maxDt = v;
            }
            const avgDt = sum / frameSampleCount;
            webglState.fps = avgDt > 0 ? Math.round(1000 / avgDt) : 0;
            webglState.fps1Low = maxDt > 0 ? Math.round(1000 / maxDt) : 0;
          }
        }
      }
      lastRafTs = now;
      webglState.lastFrameDrawCalls = webglState.currentDrawCalls;
      webglState.lastFrameTriangles = webglState.currentTriangles;
      webglState.currentDrawCalls = 0;
      webglState.currentTriangles = 0;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function instrumentWebGLContext(gl, contextType, canvas) {
    if (!gl || gl.__joltInstrumented) return;
    gl.__joltInstrumented = true;
    webglState.active = true;
    webglState.contextType = contextType === 'webgl2' ? 'webgl2' : 'webgl';
    webglState.canvas = canvas;
    startFrameMonitor();

    const origDrawArrays = gl.drawArrays.bind(gl);
    gl.drawArrays = (mode, first, count) => {
      webglState.currentDrawCalls++;
      webglState.currentTriangles += estimateTriangles(mode, count);
      return origDrawArrays(mode, first, count);
    };

    const origDrawElements = gl.drawElements.bind(gl);
    gl.drawElements = (mode, count, type, offset) => {
      webglState.currentDrawCalls++;
      webglState.currentTriangles += estimateTriangles(mode, count);
      return origDrawElements(mode, count, type, offset);
    };

    if (typeof gl.drawArraysInstanced === 'function') {
      const origInst = gl.drawArraysInstanced.bind(gl);
      gl.drawArraysInstanced = (mode, first, count, primcount) => {
        webglState.currentDrawCalls++;
        webglState.currentTriangles += estimateTriangles(mode, count) * Math.max(1, primcount || 1);
        return origInst(mode, first, count, primcount);
      };
    }

    if (typeof gl.drawElementsInstanced === 'function') {
      const origElInst = gl.drawElementsInstanced.bind(gl);
      gl.drawElementsInstanced = (mode, count, type, offset, primcount) => {
        webglState.currentDrawCalls++;
        webglState.currentTriangles += estimateTriangles(mode, count) * Math.max(1, primcount || 1);
        return origElInst(mode, count, type, offset, primcount);
      };
    }

    const wrapCreate = (methodName, key) => {
      if (typeof gl[methodName] !== 'function') return;
      const orig = gl[methodName].bind(gl);
      gl[methodName] = (...args) => {
        webglState[key]++;
        return orig(...args);
      };
    };
    const wrapDelete = (methodName, key) => {
      if (typeof gl[methodName] !== 'function') return;
      const orig = gl[methodName].bind(gl);
      gl[methodName] = (...args) => {
        if (args[0] && webglState[key] > 0) webglState[key]--;
        return orig(...args);
      };
    };

    wrapCreate('createProgram', 'programs');
    wrapDelete('deleteProgram', 'programs');
    wrapCreate('createTexture', 'textures');
    wrapDelete('deleteTexture', 'textures');
    wrapCreate('createBuffer', 'buffers');
    wrapDelete('deleteBuffer', 'buffers');
  }

  if (webglState.enabled) {
    const origGetContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(contextId, options) {
      const ctx = origGetContext.call(this, contextId, options);
      if (
        webglState.enabled &&
        ctx &&
        (contextId === 'webgl2' || contextId === 'webgl' || contextId === 'experimental-webgl')
      ) {
        instrumentWebGLContext(ctx, contextId, this);
      }
      return ctx;
    };
  }

  function configureWebGLProbe(opts) {
    if (!opts || typeof opts !== 'object') return;
    if (typeof opts.enabled === 'boolean') webglState.enabled = opts.enabled;
    if (typeof opts.pick3D === 'boolean') webglState.pick3D = opts.pick3D;
  }

  function getWebGLSnapshot() {
    if (!webglState.enabled || !webglState.active) return null;
    let sceneNodes = [];
    if (typeof webglState.sceneGetter === 'function') {
      try {
        const nodes = webglState.sceneGetter();
        if (Array.isArray(nodes)) {
          sceneNodes = nodes.slice(0, 15);
        }
      } catch {
        sceneNodes = [];
      }
    }
    return {
      active: true,
      contextType: webglState.contextType,
      fps: webglState.fps,
      fps1Low: webglState.fps1Low,
      drawCallsPerFrame: webglState.lastFrameDrawCalls,
      trianglesPerFrame: webglState.lastFrameTriangles,
      programs: webglState.programs,
      textures: webglState.textures,
      buffers: webglState.buffers,
      canvasSize: webglState.canvas
        ? { width: webglState.canvas.width, height: webglState.canvas.height }
        : { width: 0, height: 0 },
      sceneNodes,
    };
  }

  function pickWebGLSceneNode(clientX, clientY) {
    if (!webglState.enabled || !webglState.pick3D || !webglState.active || !webglState.canvas || typeof webglState.sceneGetter !== 'function') {
      return null;
    }
    let nodes = [];
    try {
      nodes = webglState.sceneGetter() || [];
    } catch {
      return null;
    }
    let best = null;
    let bestDist = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const r = n && n.screenRect;
      if (!r || r.width <= 0 || r.height <= 0) continue;
      if (clientX >= r.x && clientX <= r.x + r.width && clientY >= r.y && clientY <= r.y + r.height) {
        const cx = r.x + r.width / 2;
        const cy = r.y + r.height / 2;
        const d = Math.hypot(clientX - cx, clientY - cy);
        if (d < bestDist) {
          bestDist = d;
          best = n;
        }
      }
    }
    return best;
  }
`;
}
