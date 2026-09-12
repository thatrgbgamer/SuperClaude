// WebGL2 renderer. No libraries — everything from raw GL calls, so the app
// runs from a plain static file server with nothing to install.

import { m4identity, m4mul, m4perspective, m4ortho, m4lookAt, m4basisFromDir, norm, sub, add, mul, len } from './math.js';
import { buildTextureArray } from './textures.js';

export const FLOATS_PER_VERT = 12; // pos3 + normal3 + uv2 + layer1 + tint3
const SHADOW_SIZE = 2048;

const VERT_SRC = `#version 300 es
in vec3 aPos;
in vec3 aNormal;
in vec2 aUV;
in float aLayer;
in vec3 aTint;

uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
uniform mat4 uLightVP;

out vec3 vNormal;
out vec2 vUV;
out float vLayer;
out vec3 vTint;
out vec3 vWorld;
out vec4 vLightPos;

void main() {
  vec4 world = uModel * vec4(aPos, 1.0);
  vWorld = world.xyz;
  vNormal = mat3(uModel) * aNormal;
  vUV = aUV;
  vLayer = aLayer;
  vTint = aTint;
  vLightPos = uLightVP * world;
  gl_Position = uProj * uView * world;
}`;

const FRAG_SRC = `#version 300 es
precision highp float;
precision highp sampler2DArray;
precision highp sampler2DShadow;

in vec3 vNormal;
in vec2 vUV;
in float vLayer;
in vec3 vTint;
in vec3 vWorld;
in vec4 vLightPos;

uniform sampler2DArray uTex;
uniform sampler2DShadow uShadow;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uAmbient;
uniform vec3 uCamPos;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform int uPointCount;
uniform vec3 uPointPos[16];
uniform vec3 uPointColor[16];
uniform float uPointRadius[16];
uniform float uEmissive;

out vec4 fragColor;

float sampleShadow(vec3 N) {
  vec3 proj = vLightPos.xyz / vLightPos.w;
  proj = proj * 0.5 + 0.5;
  if (proj.z > 1.0 || proj.x < 0.0 || proj.x > 1.0 || proj.y < 0.0 || proj.y > 1.0) return 1.0;
  float bias = max(0.0025 * (1.0 - dot(N, -uSunDir)), 0.0009);
  float sum = 0.0;
  vec2 texel = vec2(1.0 / ${SHADOW_SIZE}.0);
  for (int x = -1; x <= 1; x++) {
    for (int y = -1; y <= 1; y++) {
      sum += texture(uShadow, vec3(proj.xy + vec2(float(x), float(y)) * texel, proj.z - bias));
    }
  }
  return sum / 9.0;
}

void main() {
  vec3 albedo = texture(uTex, vec3(vUV, vLayer)).rgb * vTint;
  vec3 N = normalize(vNormal);

  if (uEmissive > 0.5) {
    fragColor = vec4(albedo, 1.0);
    return;
  }

  float ndl = max(dot(N, -uSunDir), 0.0);
  float shadow = sampleShadow(N);
  vec3 light = uAmbient + uSunColor * ndl * shadow;

  for (int i = 0; i < 16; i++) {
    if (i >= uPointCount) break;
    vec3 delta = uPointPos[i] - vWorld;
    float d = length(delta);
    if (d > uPointRadius[i]) continue;
    float atten = 1.0 - d / uPointRadius[i];
    atten *= atten;
    light += uPointColor[i] * atten * max(dot(N, delta / max(d, 0.001)), 0.0);
  }

  vec3 color = albedo * light;

  float viewDist = length(vWorld - uCamPos);
  float fog = 1.0 - exp(-viewDist * uFogDensity);
  color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));

  fragColor = vec4(color, 1.0);
}`;

const SHADOW_VERT_SRC = `#version 300 es
in vec3 aPos;
uniform mat4 uLightVP;
uniform mat4 uModel;
void main() { gl_Position = uLightVP * uModel * vec4(aPos, 1.0); }`;

const SHADOW_FRAG_SRC = `#version 300 es
precision highp float;
void main() {}`;

function compile(gl, type, src) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error('Shader compile failed: ' + gl.getShaderInfoLog(shader));
  }
  return shader;
}

function link(gl, vertSrc, fragSrc) {
  const prog = gl.createProgram();
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vertSrc));
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fragSrc));
  gl.bindAttribLocation(prog, 0, 'aPos');
  gl.bindAttribLocation(prog, 1, 'aNormal');
  gl.bindAttribLocation(prog, 2, 'aUV');
  gl.bindAttribLocation(prog, 3, 'aLayer');
  gl.bindAttribLocation(prog, 4, 'aTint');
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error('Program link failed: ' + gl.getProgramInfoLog(prog));
  }
  return prog;
}

// ---------------------------------------------------------------------------
// Mesh building
// ---------------------------------------------------------------------------

export class MeshBuilder {
  constructor() { this.verts = []; }

  get vertexCount() { return this.verts.length / FLOATS_PER_VERT; }

  pushVert(p, n, uv, layer, tint) {
    this.verts.push(p[0], p[1], p[2], n[0], n[1], n[2], uv[0], uv[1], layer, tint[0], tint[1], tint[2]);
  }

  // Triangulates a convex polygon as a fan and projects UVs onto the dominant
  // axis plane, which keeps texture scale consistent across arbitrary brushes.
  pushPolygon(points, normal, layer, tint = [1, 1, 1], uvScale = 0.5) {
    if (points.length < 3) return;
    const ax = Math.abs(normal[0]), ay = Math.abs(normal[1]), az = Math.abs(normal[2]);
    let uAxis, vAxis;
    if (ay >= ax && ay >= az) { uAxis = 0; vAxis = 2; }
    else if (ax >= az) { uAxis = 2; vAxis = 1; }
    else { uAxis = 0; vAxis = 1; }

    for (let i = 1; i < points.length - 1; i++) {
      for (const p of [points[0], points[i], points[i + 1]]) {
        this.pushVert(p, normal, [p[uAxis] * uvScale, p[vAxis] * uvScale], layer, tint);
      }
    }
  }

  pushBox(min, max, layer, tint = [1, 1, 1], uvScale = 0.5) {
    const [x0, y0, z0] = min, [x1, y1, z1] = max;
    const faces = [
      { n: [0, 1, 0], pts: [[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]] },
      { n: [0, -1, 0], pts: [[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]] },
      { n: [0, 0, 1], pts: [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]] },
      { n: [0, 0, -1], pts: [[x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0]] },
      { n: [1, 0, 0], pts: [[x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1]] },
      { n: [-1, 0, 0], pts: [[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]] },
    ];
    for (const f of faces) this.pushPolygon(f.pts, f.n, layer, tint, uvScale);
  }

  toFloat32Array() { return new Float32Array(this.verts); }
}

// A unit box centred at the origin, reused for every dynamic object and scaled
// per-draw — avoids rebuilding geometry for props and ragdoll bones each frame.
function buildUnitBox() {
  const b = new MeshBuilder();
  b.pushBox([-0.5, -0.5, -0.5], [0.5, 0.5, 0.5], 0, [1, 1, 1], 1);
  return b.toFloat32Array();
}

function buildUnitSphere(segments = 12, rings = 8) {
  const b = new MeshBuilder();
  for (let r = 0; r < rings; r++) {
    const phi0 = (r / rings) * Math.PI, phi1 = ((r + 1) / rings) * Math.PI;
    for (let s = 0; s < segments; s++) {
      const th0 = (s / segments) * Math.PI * 2, th1 = ((s + 1) / segments) * Math.PI * 2;
      const p = (phi, th) => [Math.sin(phi) * Math.cos(th) * 0.5, Math.cos(phi) * 0.5, Math.sin(phi) * Math.sin(th) * 0.5];
      const quad = [p(phi0, th0), p(phi1, th0), p(phi1, th1), p(phi0, th1)];
      const n = norm(quad[0]);
      b.pushPolygon(quad, n, 0, [1, 1, 1], 1);
    }
  }
  return b.toFloat32Array();
}

export class Renderer {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false });
    if (!gl) throw new Error('WebGL2 is required and not available in this browser.');
    this.gl = gl;
    this.canvas = canvas;

    this.program = link(gl, VERT_SRC, FRAG_SRC);
    this.shadowProgram = link(gl, SHADOW_VERT_SRC, SHADOW_FRAG_SRC);

    this.uniforms = {};
    for (const name of ['uProj', 'uView', 'uModel', 'uLightVP', 'uTex', 'uShadow', 'uSunDir',
      'uSunColor', 'uAmbient', 'uCamPos', 'uFogColor', 'uFogDensity', 'uPointCount',
      'uPointPos', 'uPointColor', 'uPointRadius', 'uEmissive']) {
      this.uniforms[name] = gl.getUniformLocation(this.program, name);
    }
    this.shadowUniforms = {
      uLightVP: gl.getUniformLocation(this.shadowProgram, 'uLightVP'),
      uModel: gl.getUniformLocation(this.shadowProgram, 'uModel'),
    };

    this.worldVAO = this.createVAO(new Float32Array(0));
    this.worldCount = 0;
    this.unitBox = this.createVAO(buildUnitBox());
    this.unitBoxCount = buildUnitBox().length / FLOATS_PER_VERT;
    this.unitSphere = this.createVAO(buildUnitSphere());
    this.unitSphereCount = buildUnitSphere().length / FLOATS_PER_VERT;

    this.dynamicBuffer = gl.createBuffer();
    this.dynamicVAO = this.createVAOFromBuffer(this.dynamicBuffer);

    this.setupShadowMap();

    this.texture = null;
    this.proj = new Float32Array(16);
    this.view = new Float32Array(16);
    this.lightVP = new Float32Array(16);
    this.model = m4identity(new Float32Array(16));
    this.scratch = new Float32Array(16);
    this.scratch2 = new Float32Array(16);

    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
  }

  createVAOFromBuffer(buffer) {
    const gl = this.gl;
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = FLOATS_PER_VERT * 4;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 32);
    gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4, 3, gl.FLOAT, false, stride, 36);
    gl.bindVertexArray(null);
    return vao;
  }

  createVAO(data) {
    const gl = this.gl;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    const vao = this.createVAOFromBuffer(buffer);
    vao.buffer = buffer;
    return vao;
  }

  setupShadowMap() {
    const gl = this.gl;
    this.shadowTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, SHADOW_SIZE, SHADOW_SIZE, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);

    this.shadowFBO = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
    gl.drawBuffers([gl.NONE]);
    gl.readBuffer(gl.NONE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  setMaterials(materials) {
    if (this.texture) this.gl.deleteTexture(this.texture);
    this.texture = buildTextureArray(this.gl, materials);
    this.materials = materials;
  }

  setWorldMesh(float32) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, this.worldVAO.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, float32, gl.STATIC_DRAW);
    this.worldCount = float32.length / FLOATS_PER_VERT;
  }

  resize() {
    const canvas = this.canvas;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    return canvas.width / Math.max(canvas.height, 1);
  }

  computeLightMatrix(sunDir, bounds) {
    const center = mul(add(bounds.min, bounds.max), 0.5);
    const radius = Math.max(len(sub(bounds.max, bounds.min)) * 0.5, 10);
    const eye = sub(center, mul(norm(sunDir), radius * 2));
    m4lookAt(eye, center, [0, 1, 0], this.scratch);
    m4ortho(-radius, radius, -radius, radius, 0.1, radius * 4, this.scratch2);
    m4mul(this.scratch2, this.scratch, this.lightVP);
  }

  beginShadowPass() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFBO);
    gl.viewport(0, 0, SHADOW_SIZE, SHADOW_SIZE);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(this.shadowProgram);
    gl.uniformMatrix4fv(this.shadowUniforms.uLightVP, false, this.lightVP);
    gl.cullFace(gl.FRONT); // front-face culling pushes peter-panning off surfaces
  }

  endShadowPass() {
    this.gl.cullFace(this.gl.BACK);
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
  }

  beginFrame(camera, env, aspect) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    const sky = env.skyColor || [0.45, 0.55, 0.7];
    gl.clearColor(sky[0], sky[1], sky[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    m4perspective(camera.fov || 75, aspect, 0.05, 500, this.proj);
    m4lookAt(camera.position, add(camera.position, camera.forward), [0, 1, 0], this.view);

    gl.useProgram(this.program);
    gl.uniformMatrix4fv(this.uniforms.uProj, false, this.proj);
    gl.uniformMatrix4fv(this.uniforms.uView, false, this.view);
    gl.uniformMatrix4fv(this.uniforms.uLightVP, false, this.lightVP);
    gl.uniform3fv(this.uniforms.uSunDir, norm(env.sunDir || [-0.4, -0.8, -0.3]));
    gl.uniform3fv(this.uniforms.uSunColor, env.sunColor || [1.0, 0.96, 0.88]);
    gl.uniform3fv(this.uniforms.uAmbient, env.ambient || [0.32, 0.34, 0.4]);
    gl.uniform3fv(this.uniforms.uCamPos, camera.position);
    gl.uniform3fv(this.uniforms.uFogColor, env.fogColor || sky);
    gl.uniform1f(this.uniforms.uFogDensity, env.fogDensity ?? 0.012);
    gl.uniform1f(this.uniforms.uEmissive, 0);

    const lights = (env.pointLights || []).slice(0, 16);
    gl.uniform1i(this.uniforms.uPointCount, lights.length);
    if (lights.length) {
      const pos = new Float32Array(lights.length * 3);
      const col = new Float32Array(lights.length * 3);
      const rad = new Float32Array(lights.length);
      lights.forEach((l, i) => {
        pos.set(l.position, i * 3);
        col.set(l.color, i * 3);
        rad[i] = l.radius;
      });
      gl.uniform3fv(this.uniforms.uPointPos, pos);
      gl.uniform3fv(this.uniforms.uPointColor, col);
      gl.uniform1fv(this.uniforms.uPointRadius, rad);
    }

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.texture);
    gl.uniform1i(this.uniforms.uTex, 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
    gl.uniform1i(this.uniforms.uShadow, 1);
  }

  drawWorld(shadowPass = false) {
    const gl = this.gl;
    if (!this.worldCount) return;
    const loc = shadowPass ? this.shadowUniforms.uModel : this.uniforms.uModel;
    gl.uniformMatrix4fv(loc, false, m4identity(this.model));
    gl.bindVertexArray(this.worldVAO);
    gl.drawArrays(gl.TRIANGLES, 0, this.worldCount);
  }

  // Draws the unit box scaled/rotated into place. `basis` is an optional
  // rotation matrix (ragdoll bones use one built from the segment direction).
  drawBox(center, halfExtents, layer, tint = [1, 1, 1], basis = null, shadowPass = false) {
    const gl = this.gl;
    const m = this.model;
    if (basis) {
      m.set(basis);
      m[0] *= halfExtents[0] * 2; m[1] *= halfExtents[0] * 2; m[2] *= halfExtents[0] * 2;
      m[4] *= halfExtents[1] * 2; m[5] *= halfExtents[1] * 2; m[6] *= halfExtents[1] * 2;
      m[8] *= halfExtents[2] * 2; m[9] *= halfExtents[2] * 2; m[10] *= halfExtents[2] * 2;
    } else {
      m4identity(m);
      m[0] = halfExtents[0] * 2; m[5] = halfExtents[1] * 2; m[10] = halfExtents[2] * 2;
    }
    m[12] = center[0]; m[13] = center[1]; m[14] = center[2];

    if (shadowPass) {
      gl.uniformMatrix4fv(this.shadowUniforms.uModel, false, m);
    } else {
      gl.uniformMatrix4fv(this.uniforms.uModel, false, m);
      gl.vertexAttrib1f(3, layer);
      gl.vertexAttrib3f(4, tint[0], tint[1], tint[2]);
    }
    gl.bindVertexArray(this.unitBox);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.vertexAttrib1f(3, layer);
    gl.vertexAttrib3f(4, tint[0], tint[1], tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, this.unitBoxCount);
    gl.enableVertexAttribArray(3);
    gl.enableVertexAttribArray(4);
  }

  drawSphere(center, radius, layer, tint = [1, 1, 1], shadowPass = false) {
    const gl = this.gl;
    const m = m4identity(this.model);
    m[0] = m[5] = m[10] = radius * 2;
    m[12] = center[0]; m[13] = center[1]; m[14] = center[2];
    if (shadowPass) {
      gl.uniformMatrix4fv(this.shadowUniforms.uModel, false, m);
    } else {
      gl.uniformMatrix4fv(this.uniforms.uModel, false, m);
    }
    gl.bindVertexArray(this.unitSphere);
    gl.disableVertexAttribArray(3);
    gl.disableVertexAttribArray(4);
    gl.vertexAttrib1f(3, layer);
    gl.vertexAttrib3f(4, tint[0], tint[1], tint[2]);
    gl.drawArrays(gl.TRIANGLES, 0, this.unitSphereCount);
    gl.enableVertexAttribArray(3);
    gl.enableVertexAttribArray(4);
  }

  // Orients a box along the segment a->b. Ragdoll limbs draw with this.
  drawSegment(a, b, thickness, layer, tint, shadowPass = false) {
    const delta = sub(b, a);
    const length = len(delta);
    if (length < 1e-5) return;
    const center = mul(add(a, b), 0.5);
    const basis = m4basisFromDir(delta, this.scratch);
    this.drawBox(center, [thickness, length * 0.5, thickness], layer, tint, basis, shadowPass);
  }

  setEmissive(on) {
    this.gl.uniform1f(this.uniforms.uEmissive, on ? 1 : 0);
  }
}
