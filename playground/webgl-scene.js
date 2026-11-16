/**
 * Pure WebGL2 3D Scene (zero external libs) designed for Jolt Lab.
 * Renders 3 distinct selectable 3D meshes with live screen-space projection
 * so Alt+Hover / Alt+Clic inside <canvas> targets individual 3D objects,
 * while preserving 60Hz/120Hz Apple Silicon performance (zero per-frame allocations).
 */

export const PALETTES = {
  cyan: [0.22, 0.74, 0.97],
  amber: [0.96, 0.62, 0.04],
  emerald: [0.06, 0.72, 0.51],
  rose: [0.95, 0.35, 0.52],
  violet: [0.62, 0.45, 0.98],
};

export function createDefaultSceneNodes() {
  return [
    {
      id: 'item-1',
      name: 'CryoOctahedron',
      type: 'OctahedronMesh',
      loc: 'playground/webgl-scene.js:19:5',
      position: [-1.85, 0.0, -4.6],
      scale: 0.95,
      tiltX: -0.5,
      spinX: -0.95,
      spinY: 0.35,
      colorKey: 'cyan',
      radius: 0.92,
      visible: true,
    },
    {
      id: 'item-2',
      name: 'OrbitalTorus',
      type: 'TorusMesh',
      loc: 'playground/webgl-scene.js:33:5',
      position: [0.0, 0.0, -4.6],
      scale: 0.85,
      tiltX: 1.12,
      spinX: 0,
      spinY: -0.85,
      colorKey: 'emerald',
      radius: 1.05,
      visible: true,
    },
    {
      id: 'item-3',
      name: 'SolarPrism',
      type: 'PrismMesh',
      loc: 'playground/webgl-scene.js:47:5',
      position: [1.85, 0.0, -4.6],
      scale: 0.95,
      tiltX: 0.59,
      spinX: 0,
      spinY: 1.0,
      colorKey: 'amber',
      radius: 0.92,
      visible: true,
    },
  ];
}

const VERTEX_SHADER_SRC = `#version 300 es
precision highp float;
layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;

uniform mat4 uMvp;
uniform mat4 uModel;

out vec3 vNormal;
out vec3 vWorldPos;

void main() {
  vec4 world = uModel * vec4(aPosition, 1.0);
  vWorldPos = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  gl_Position = uMvp * vec4(aPosition, 1.0);
}
`;

const FRAGMENT_SHADER_SRC = `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vWorldPos;

uniform vec3 uColor;
uniform vec3 uLightDir;

out vec4 outColor;

void main() {
  vec3 n = normalize(vNormal);
  vec3 l = normalize(uLightDir);
  vec3 v = normalize(vec3(0.0, 0.4, 3.8) - vWorldPos);
  float diff = max(dot(n, l), 0.14);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.5);
  vec3 lit = uColor * (diff * 0.95 + 0.18) + vec3(0.85, 0.95, 1.0) * rim * 0.45;
  outColor = vec4(lit, 0.96);
}
`;

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error('Shader compile failed: ' + info);
  }
  return shader;
}

function buildBipyramidGeometry(sides, halfHeight, ringRadius) {
  const top = [0, halfHeight, 0];
  const bottom = [0, -halfHeight, 0];
  const ring = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    ring.push([Math.cos(a) * ringRadius, 0, Math.sin(a) * ringRadius]);
  }

  const positions = [];
  const normals = [];
  const pushTri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    positions.push(...a, ...b, ...c);
    for (let i = 0; i < 3; i++) {
      normals.push(nx / len, ny / len, nz / len);
    }
  };

  for (let i = 0; i < sides; i++) {
    const next = (i + 1) % sides;
    pushTri(top, ring[next], ring[i]);
    pushTri(bottom, ring[i], ring[next]);
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    vertexCount: positions.length / 3,
  };
}

function buildOrbitalRingGeometry(segments = 48, majorR = 0.88, minorR = 0.16) {
  const positions = [];
  const normals = [];
  const radialSegs = 12;

  for (let i = 0; i < segments; i++) {
    const u0 = (i / segments) * Math.PI * 2;
    const u1 = ((i + 1) / segments) * Math.PI * 2;
    for (let j = 0; j < radialSegs; j++) {
      const v0 = (j / radialSegs) * Math.PI * 2;
      const v1 = ((j + 1) / radialSegs) * Math.PI * 2;

      const pt = (u, v) => {
        const cx = (majorR + minorR * Math.cos(v)) * Math.cos(u);
        const cy = minorR * Math.sin(v);
        const cz = (majorR + minorR * Math.cos(v)) * Math.sin(u);
        const nx = Math.cos(v) * Math.cos(u);
        const ny = Math.sin(v);
        const nz = Math.cos(v) * Math.sin(u);
        return { p: [cx, cy, cz], n: [nx, ny, nz] };
      };

      const a = pt(u0, v0);
      const b = pt(u1, v0);
      const c = pt(u1, v1);
      const d = pt(u0, v1);

      positions.push(...a.p, ...b.p, ...c.p, ...a.p, ...c.p, ...d.p);
      normals.push(...a.n, ...b.n, ...c.n, ...a.n, ...c.n, ...d.n);
    }
  }

  return {
    positions: new Float32Array(positions),
    normals: new Float32Array(normals),
    vertexCount: positions.length / 3,
  };
}

function writePerspective(out, fovyRad, aspect, near, far) {
  const f = 1.0 / Math.tan(fovyRad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
}

function writeTransformXYZ(out, rx, ry, tx, ty, tz, scale) {
  const cx = Math.cos(rx), sx = Math.sin(rx);
  const cy = Math.cos(ry), sy = Math.sin(ry);
  out[0] = cy * scale;
  out[1] = sx * sy * scale;
  out[2] = -cx * sy * scale;
  out[3] = 0;

  out[4] = 0;
  out[5] = cx * scale;
  out[6] = sx * scale;
  out[7] = 0;

  out[8] = sy * scale;
  out[9] = -sx * cy * scale;
  out[10] = cx * cy * scale;
  out[11] = 0;

  out[12] = tx;
  out[13] = ty;
  out[14] = tz;
  out[15] = 1;
}

function multiplyMat4(out, a, b) {
  for (let col = 0; col < 4; col++) {
    const b0 = b[col * 4], b1 = b[col * 4 + 1], b2 = b[col * 4 + 2], b3 = b[col * 4 + 3];
    out[col * 4] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[col * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[col * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[col * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
}

function uploadMesh(gl, geo) {
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);

  const posBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
  gl.bufferData(gl.ARRAY_BUFFER, geo.positions, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);

  const normBuf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, normBuf);
  gl.bufferData(gl.ARRAY_BUFFER, geo.normals, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(1);
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);

  gl.bindVertexArray(null);
  return { vao, count: geo.vertexCount };
}

function projectNodeScreenRect(canvasRect, projMat, pos, scale, radius) {
  const tz = pos[2];
  const clipW = -tz;
  if (clipW <= 0.1 || canvasRect.width <= 0 || canvasRect.height <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const ndcX = (projMat[0] * pos[0]) / clipW;
  const ndcY = (projMat[5] * pos[1]) / clipW;
  const px = canvasRect.left + (ndcX * 0.5 + 0.5) * canvasRect.width;
  const py = canvasRect.top + (0.5 - ndcY * 0.5) * canvasRect.height;

  const worldRadius = radius * scale;
  const halfW = ((projMat[0] * worldRadius) / clipW) * 0.5 * canvasRect.width;
  const halfH = ((projMat[5] * worldRadius) / clipW) * 0.5 * canvasRect.height;

  return {
    x: Math.round(px - halfW),
    y: Math.round(py - halfH),
    width: Math.round(halfW * 2),
    height: Math.round(halfH * 2),
  };
}

export function initWebGLScene(canvas, stateRef) {
  if (!Array.isArray(stateRef.sceneNodes) || stateRef.sceneNodes.length === 0) {
    stateRef.sceneNodes = createDefaultSceneNodes();
  }

  const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: true,
    stencil: false,
    depth: true,
    powerPreference: 'high-performance',
  });

  const badge = document.getElementById('webgl-badge');
  if (!gl) {
    if (badge) badge.textContent = 'WebGL2 indisponible';
    return null;
  }

  const vs = compileShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SRC);
  const program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.useProgram(program);

  const uMvp = gl.getUniformLocation(program, 'uMvp');
  const uModel = gl.getUniformLocation(program, 'uModel');
  const uColor = gl.getUniformLocation(program, 'uColor');
  const uLightDir = gl.getUniformLocation(program, 'uLightDir');
  gl.uniform3f(uLightDir, 0.7, 1.1, 0.85);

  const meshByType = {
    OctahedronMesh: uploadMesh(gl, buildBipyramidGeometry(4, 1.0, 0.78)),
    TorusMesh: uploadMesh(gl, buildOrbitalRingGeometry(48, 0.88, 0.17)),
    PrismMesh: uploadMesh(gl, buildBipyramidGeometry(6, 1.0, 0.76)),
  };

  const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
  const maxDpr = isSafari ? 1.25 : 1.5;

  const projMat = new Float32Array(16);
  const modelMat = new Float32Array(16);
  const mvpMat = new Float32Array(16);

  let width = 1;
  let height = 1;
  let lastCanvasRect = canvas.getBoundingClientRect();

  function resizeCanvas() {
    lastCanvasRect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
    const nextW = Math.max(1, Math.round(lastCanvasRect.width * dpr));
    const nextH = Math.max(1, Math.round(lastCanvasRect.height * dpr));
    if (nextW !== width || nextH !== height) {
      width = nextW;
      height = nextH;
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    writePerspective(projMat, Math.PI / 4, width / Math.max(1, height), 0.1, 20);
  }

  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  gl.enable(gl.DEPTH_TEST);
  gl.clearColor(0, 0, 0, 0);

  let angleY = 0;
  let smoothedSpeed = stateRef.rotationSpeed;
  let lastTime = performance.now();

  const lastPillCache = ['', '', ''];
  function syncNodePills() {
    for (let i = 0; i < stateRef.sceneNodes.length; i++) {
      const node = stateRef.sceneNodes[i];
      const pill = document.getElementById(`node-pill-${i + 1}`);
      if (!pill) continue;
      const text = `${node.name} [${node.position.map((v) => Number(v).toFixed(2)).join(', ')}]`;
      if (lastPillCache[i] !== text) {
        lastPillCache[i] = text;
        pill.textContent = text;
        pill.dataset.color = node.colorKey || 'cyan';
      }
    }
  }

  if (window.__JOLT__) {
    window.__JOLT__.registerScene(() => {
      const rect = canvas.getBoundingClientRect();
      lastCanvasRect = rect;
      return stateRef.sceneNodes.map((node) => ({
        id: node.id,
        name: node.name,
        type: node.type,
        loc: node.loc,
        position: [...node.position],
        scale: node.scale,
        color: node.colorKey,
        visible: node.visible !== false,
        screenRect: projectNodeScreenRect(rect, projMat, node.position, node.scale, node.radius),
      }));
    });
  }

  function renderFrame(now) {
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;

    // Framerate-independent exponential damping (60Hz & 120Hz identical)
    const dampFactor = 1 - Math.exp(-6.0 * dt);
    smoothedSpeed += (stateRef.rotationSpeed - smoothedSpeed) * dampFactor;
    angleY += smoothedSpeed * dt;

    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const drawMode = stateRef.wireframe ? gl.LINES : gl.TRIANGLES;
    const globalPalette = stateRef.paletteOverride ? PALETTES[stateRef.palette] : null;

    for (let i = 0; i < stateRef.sceneNodes.length; i++) {
      const node = stateRef.sceneNodes[i];
      if (node.visible === false) continue;
      const mesh = meshByType[node.type] || meshByType.OctahedronMesh;
      const baseTiltX = typeof node.tiltX === 'number' ? node.tiltX : (0.35 + i * 0.12);
      const rx = node.type === 'TorusMesh'
        ? baseTiltX + Math.sin(angleY * 0.5) * 0.25
        : baseTiltX + angleY * (typeof node.spinX === 'number' ? node.spinX : 0);
      const ry = angleY * (typeof node.spinY === 'number' ? node.spinY : (node.type === 'TorusMesh' ? -0.85 : 1.0)) + i * 0.7;

      writeTransformXYZ(modelMat, rx, ry, node.position[0], node.position[1], node.position[2], node.scale);
      multiplyMat4(mvpMat, projMat, modelMat);
      gl.uniformMatrix4fv(uModel, false, modelMat);
      gl.uniformMatrix4fv(uMvp, false, mvpMat);

      const rgb = globalPalette || PALETTES[node.colorKey] || PALETTES.cyan;
      gl.uniform3f(uColor, rgb[0], rgb[1], rgb[2]);
      gl.bindVertexArray(mesh.vao);
      gl.drawArrays(drawMode, 0, mesh.count);
    }

    syncNodePills();
    requestAnimationFrame(renderFrame);
  }

  syncNodePills();
  if (badge) {
    badge.textContent = 'WebGL2 · 3 objects · 3 drawCalls';
  }
  requestAnimationFrame(renderFrame);
  return { resizeCanvas };
}
