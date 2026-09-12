// Vectors are plain [x, y, z] arrays so they round-trip through map JSON
// exactly as authored — no class wrappers to serialize around.
// Coordinate system: Y-up, right-handed, 1 unit = 1 metre.

export const V = (x = 0, y = 0, z = 0) => [x, y, z];
export const clone = (a) => [a[0], a[1], a[2]];
export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const mulV = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const lenSq = (a) => a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
export const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const neg = (a) => [-a[0], -a[1], -a[2]];

export function norm(a) {
  const l = len(a);
  return l > 1e-9 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}

export const lerp = (a, b, t) => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const mix = (a, b, t) => a + (b - a) * t;
export const deg2rad = Math.PI / 180;
export const rad2deg = 180 / Math.PI;

export function minV(a, b) {
  return [Math.min(a[0], b[0]), Math.min(a[1], b[1]), Math.min(a[2], b[2])];
}
export function maxV(a, b) {
  return [Math.max(a[0], b[0]), Math.max(a[1], b[1]), Math.max(a[2], b[2])];
}

// Angles are [pitch, yaw, roll] in degrees, matching map-file convention.
export function anglesToForward(angles) {
  const p = angles[0] * deg2rad, y = angles[1] * deg2rad;
  const cp = Math.cos(p), sp = Math.sin(p);
  return norm([Math.cos(y) * cp, -sp, -Math.sin(y) * cp]);
}

export function anglesToRight(angles) {
  const y = angles[1] * deg2rad;
  return norm([Math.sin(y), 0, Math.cos(y)]);
}

// ---------------------------------------------------------------------------
// mat4: column-major Float32Array(16), matching WebGL's uniformMatrix4fv.
// ---------------------------------------------------------------------------

export function m4identity(out = new Float32Array(16)) {
  out.fill(0);
  out[0] = out[5] = out[10] = out[15] = 1;
  return out;
}

export function m4mul(a, b, out = new Float32Array(16)) {
  for (let c = 0; c < 4; c++) {
    const b0 = b[c * 4], b1 = b[c * 4 + 1], b2 = b[c * 4 + 2], b3 = b[c * 4 + 3];
    out[c * 4 + 0] = a[0] * b0 + a[4] * b1 + a[8] * b2 + a[12] * b3;
    out[c * 4 + 1] = a[1] * b0 + a[5] * b1 + a[9] * b2 + a[13] * b3;
    out[c * 4 + 2] = a[2] * b0 + a[6] * b1 + a[10] * b2 + a[14] * b3;
    out[c * 4 + 3] = a[3] * b0 + a[7] * b1 + a[11] * b2 + a[15] * b3;
  }
  return out;
}

export function m4perspective(fovDeg, aspect, near, far, out = new Float32Array(16)) {
  const f = 1 / Math.tan(fovDeg * deg2rad / 2);
  out.fill(0);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = (2 * far * near) / (near - far);
  return out;
}

export function m4ortho(l, r, b, t, near, far, out = new Float32Array(16)) {
  out.fill(0);
  out[0] = 2 / (r - l);
  out[5] = 2 / (t - b);
  out[10] = -2 / (far - near);
  out[12] = -(r + l) / (r - l);
  out[13] = -(t + b) / (t - b);
  out[14] = -(far + near) / (far - near);
  out[15] = 1;
  return out;
}

export function m4lookAt(eye, target, up, out = new Float32Array(16)) {
  const z = norm(sub(eye, target));
  let x = cross(up, z);
  if (lenSq(x) < 1e-12) x = cross([0, 0, 1], z); // up parallel to view: pick another axis
  x = norm(x);
  const y = cross(z, x);
  out[0] = x[0]; out[1] = y[0]; out[2] = z[0]; out[3] = 0;
  out[4] = x[1]; out[5] = y[1]; out[6] = z[1]; out[7] = 0;
  out[8] = x[2]; out[9] = y[2]; out[10] = z[2]; out[11] = 0;
  out[12] = -dot(x, eye); out[13] = -dot(y, eye); out[14] = -dot(z, eye); out[15] = 1;
  return out;
}

export function m4translate(v, out = new Float32Array(16)) {
  m4identity(out);
  out[12] = v[0]; out[13] = v[1]; out[14] = v[2];
  return out;
}

export function m4scale(v, out = new Float32Array(16)) {
  m4identity(out);
  out[0] = v[0]; out[5] = v[1]; out[10] = v[2];
  return out;
}

export function m4rotateY(rad, out = new Float32Array(16)) {
  m4identity(out);
  const c = Math.cos(rad), s = Math.sin(rad);
  out[0] = c; out[2] = -s; out[8] = s; out[10] = c;
  return out;
}

export function m4fromAngles(angles, out = new Float32Array(16)) {
  const p = angles[0] * deg2rad, y = angles[1] * deg2rad, r = angles[2] * deg2rad;
  const cp = Math.cos(p), sp = Math.sin(p);
  const cy = Math.cos(y), sy = Math.sin(y);
  const cr = Math.cos(r), sr = Math.sin(r);
  out[0] = cy * cp; out[1] = -sp; out[2] = -sy * cp; out[3] = 0;
  out[4] = cy * sp * cr + sy * sr; out[5] = cp * cr; out[6] = -sy * sp * cr + cy * sr; out[7] = 0;
  out[8] = -cy * sp * sr + sy * cr; out[9] = -cp * sr; out[10] = sy * sp * sr + cy * cr; out[11] = 0;
  out[12] = 0; out[13] = 0; out[14] = 0; out[15] = 1;
  return out;
}

// Build a rotation basis whose +Y axis points along `dir`. Used to orient bone
// segments along ragdoll constraints without needing full quaternion state.
export function m4basisFromDir(dir, out = new Float32Array(16)) {
  const y = norm(dir);
  let ref = Math.abs(y[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const x = norm(cross(ref, y));
  const z = cross(x, y);
  m4identity(out);
  out[0] = x[0]; out[1] = x[1]; out[2] = x[2];
  out[4] = y[0]; out[5] = y[1]; out[6] = y[2];
  out[8] = z[0]; out[9] = z[1]; out[10] = z[2];
  return out;
}

export function m4transformPoint(m, p) {
  return [
    m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
  ];
}

// Deterministic PRNG so a seeded map generates identically every run —
// important for reproducing a bug Claude is asked to fix.
export function makeRandom(seed = 1) {
  let s = seed >>> 0 || 1;
  return function random() {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
