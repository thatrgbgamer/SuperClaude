// Textures are generated from JSON parameters into a WebGL2 texture array.
// Same reasoning as audio.js: a material is a line of text Claude can write,
// not a PNG somebody has to make in another program.

export const TEX_SIZE = 256;

function hashNoise(x, y, seed) {
  let h = x * 374761393 + y * 668265263 + seed * 1274126177;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967296;
}

function smoothNoise(x, y, seed) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hashNoise(xi, yi, seed), b = hashNoise(xi + 1, yi, seed);
  const c = hashNoise(xi, yi + 1, seed), d = hashNoise(xi + 1, yi + 1, seed);
  return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
}

function fbm(x, y, seed, octaves = 4) {
  let sum = 0, amp = 0.5, freq = 1, norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += smoothNoise(x * freq, y * freq, seed + i * 31) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

const GENERATORS = {
  solid: (x, y, m) => 1,

  noise: (x, y, m) => {
    const s = m.scale ?? 4;
    return 1 - m.contrast + fbm(x * s, y * s, m.seed ?? 1) * m.contrast * 2;
  },

  checker: (x, y, m) => {
    const s = m.scale ?? 4;
    const c = (Math.floor(x * s) + Math.floor(y * s)) % 2;
    return c ? 1 : 1 - (m.contrast ?? 0.25);
  },

  grid: (x, y, m) => {
    const s = m.scale ?? 4;
    const w = m.lineWidth ?? 0.04;
    const fx = (x * s) % 1, fy = (y * s) % 1;
    const onLine = fx < w || fy < w || fx > 1 - w || fy > 1 - w;
    const grain = 1 - (m.contrast ?? 0.12) + fbm(x * s * 6, y * s * 6, m.seed ?? 3) * (m.contrast ?? 0.12) * 2;
    return onLine ? grain * (1 - (m.lineDarkness ?? 0.45)) : grain;
  },

  brick: (x, y, m) => {
    const rows = m.rows ?? 8;
    const cols = m.cols ?? 4;
    const mortar = m.mortar ?? 0.045;
    const row = Math.floor(y * rows);
    const offset = row % 2 ? 0.5 : 0;
    const bx = (x * cols + offset) % 1;
    const by = (y * rows) % 1;
    if (bx < mortar * cols || by < mortar * rows) return 1 - (m.mortarDarkness ?? 0.35);
    const variation = hashNoise(Math.floor(x * cols + offset), row, m.seed ?? 7);
    return 0.85 + variation * 0.3 + fbm(x * 30, y * 30, m.seed ?? 7) * 0.12;
  },

  tiles: (x, y, m) => {
    const s = m.scale ?? 6;
    const gap = m.gap ?? 0.05;
    const fx = (x * s) % 1, fy = (y * s) % 1;
    if (fx < gap || fy < gap) return 1 - (m.gapDarkness ?? 0.4);
    const v = hashNoise(Math.floor(x * s), Math.floor(y * s), m.seed ?? 11);
    return 0.9 + v * 0.2;
  },

  metal: (x, y, m) => {
    const s = m.scale ?? 3;
    const streak = fbm(x * s * 0.5, y * s * 40, m.seed ?? 13, 3);
    const plate = (Math.floor(x * (m.plates ?? 2)) + Math.floor(y * (m.plates ?? 2))) % 2 ? 1 : 0.94;
    return plate * (0.86 + streak * 0.28);
  },

  grass: (x, y, m) => {
    const s = m.scale ?? 12;
    const blades = fbm(x * s * 4, y * s * 4, m.seed ?? 17, 3);
    const patches = fbm(x * s * 0.4, y * s * 0.4, (m.seed ?? 17) + 99, 3);
    return 0.7 + blades * 0.35 + patches * 0.25;
  },

  panel: (x, y, m) => {
    const s = m.scale ?? 2;
    const border = m.border ?? 0.08;
    const fx = (x * s) % 1, fy = (y * s) % 1;
    const edge = Math.min(fx, fy, 1 - fx, 1 - fy);
    const grain = 0.92 + fbm(x * 40, y * 40, m.seed ?? 19, 2) * 0.16;
    if (edge < border * 0.35) return grain * 0.72;
    if (edge < border) return grain * 1.08;
    return grain;
  },
};

export const generatorNames = Object.keys(GENERATORS);

function renderMaterial(material) {
  const gen = GENERATORS[material.generator] || GENERATORS.solid;
  const color = material.color || [0.8, 0.8, 0.8];
  const pixels = new Uint8Array(TEX_SIZE * TEX_SIZE * 4);
  const emissive = material.emissive ? 1 : 0;

  for (let py = 0; py < TEX_SIZE; py++) {
    for (let px = 0; px < TEX_SIZE; px++) {
      const u = px / TEX_SIZE, v = py / TEX_SIZE;
      let shade = gen(u, v, material);
      if (!Number.isFinite(shade)) shade = 1;
      shade = Math.max(0, Math.min(2, shade));
      const i = (py * TEX_SIZE + px) * 4;
      pixels[i] = Math.min(255, color[0] * shade * 255);
      pixels[i + 1] = Math.min(255, color[1] * shade * 255);
      pixels[i + 2] = Math.min(255, color[2] * shade * 255);
      pixels[i + 3] = emissive ? 255 : 255;
    }
  }
  return pixels;
}

// One TEXTURE_2D_ARRAY holding every material means the whole world draws in
// a single pass with no texture rebinds — the layer index rides in the vertex.
export function buildTextureArray(gl, materials) {
  const count = Math.max(1, materials.length);
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
  gl.texImage3D(gl.TEXTURE_2D_ARRAY, 0, gl.RGBA8, TEX_SIZE, TEX_SIZE, count, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);

  materials.forEach((material, layer) => {
    const pixels = renderMaterial(material);
    gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, TEX_SIZE, TEX_SIZE, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
  });

  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
  const ext = gl.getExtension('EXT_texture_filter_anisotropic');
  if (ext) gl.texParameterf(gl.TEXTURE_2D_ARRAY, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
  return tex;
}

export const DEFAULT_MATERIALS = [
  { name: 'concrete', generator: 'noise', color: [0.58, 0.58, 0.6], contrast: 0.14, scale: 6, seed: 2 },
  { name: 'floor_tile', generator: 'tiles', color: [0.46, 0.48, 0.52], scale: 4, seed: 5 },
  { name: 'brick', generator: 'brick', color: [0.55, 0.27, 0.21], rows: 10, cols: 5, seed: 7 },
  { name: 'metal', generator: 'metal', color: [0.5, 0.53, 0.58], scale: 3, plates: 2, seed: 13 },
  { name: 'grass', generator: 'grass', color: [0.24, 0.42, 0.19], scale: 10, seed: 17 },
  { name: 'panel', generator: 'panel', color: [0.62, 0.6, 0.55], scale: 2, seed: 19 },
  { name: 'grid', generator: 'grid', color: [0.35, 0.4, 0.46], scale: 4, seed: 3 },
  { name: 'light_panel', generator: 'solid', color: [1.0, 0.95, 0.82], emissive: true },
  { name: 'flesh', generator: 'noise', color: [0.72, 0.46, 0.4], contrast: 0.1, scale: 8, seed: 23 },
  { name: 'cloth', generator: 'noise', color: [0.24, 0.3, 0.42], contrast: 0.12, scale: 14, seed: 29 },
];
