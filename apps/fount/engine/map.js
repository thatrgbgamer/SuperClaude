// Map format: a level is an intersection-of-halfspaces brush list, like Quake
// and Source. Authors write friendly shapes (box, ramp, wedge, cylinder) and
// everything lowers to planes, so collision and rendering share one
// representation and arbitrary convex shapes come free.

import { dot, sub, add, cross, norm, len } from './math.js';
import { MeshBuilder } from './render.js';
import { CollisionWorld } from './physics.js';
import { DEFAULT_MATERIALS } from './textures.js';

const plane = (n, pointOnPlane) => ({ n: norm(n), d: dot(norm(n), pointOnPlane) });

function boxPlanes(min, max) {
  return [
    { n: [1, 0, 0], d: max[0] },
    { n: [-1, 0, 0], d: -min[0] },
    { n: [0, 1, 0], d: max[1] },
    { n: [0, -1, 0], d: -min[1] },
    { n: [0, 0, 1], d: max[2] },
    { n: [0, 0, -1], d: -min[2] },
  ];
}

// A ramp is the box with its top plane swapped for a slanted one. `axis` is
// the horizontal axis the slope climbs along, `dir` which way it climbs.
function rampPlanes(min, max, axis = 'x', dir = 1, low = null) {
  const ai = axis === 'z' ? 2 : 0;
  const lowY = low === null ? min[1] : low;
  const planes = boxPlanes(min, max).filter((p) => p.n[1] !== 1);

  const lowPoint = [0, 0, 0];
  const highPoint = [0, 0, 0];
  lowPoint[ai] = dir > 0 ? min[ai] : max[ai];
  highPoint[ai] = dir > 0 ? max[ai] : min[ai];
  lowPoint[1] = lowY;
  highPoint[1] = max[1];
  const other = ai === 0 ? 2 : 0;
  lowPoint[other] = min[other];
  highPoint[other] = min[other];

  const run = highPoint[ai] - lowPoint[ai];
  const rise = highPoint[1] - lowPoint[1];
  const n = [0, 0, 0];
  // The outward normal of a surface climbing along +axis tilts back toward
  // -axis, so it must follow the sign of `run`. Without this the halfspace is
  // inverted and the brush collapses to nothing at all.
  n[ai] = -rise * Math.sign(run || 1);
  n[1] = Math.abs(run);
  planes.push(plane(n, lowPoint));
  return planes;
}

// A wedge cuts the box diagonally on the horizontal plane — useful for
// angled corners and pillars without hand-writing plane equations.
function wedgePlanes(min, max, corner = 'nx-nz') {
  const planes = boxPlanes(min, max);
  // The cut runs along the diagonal between the two corners *adjacent* to the
  // one being removed, with the normal pointing at the removed corner. Putting
  // the plane through the removed corner itself (the obvious-looking choice)
  // cuts away nothing and silently leaves a plain box.
  const cuts = {
    'nx-nz': { n: [-1, 0, -1], through: [min[0], min[1], max[2]] },
    'px-nz': { n: [1, 0, -1], through: [min[0], min[1], min[2]] },
    'nx-pz': { n: [-1, 0, 1], through: [min[0], min[1], min[2]] },
    'px-pz': { n: [1, 0, 1], through: [max[0], min[1], min[2]] },
  };
  const cut = cuts[corner] || cuts['nx-nz'];
  planes.push(plane(cut.n, cut.through));
  return planes;
}

function cylinderPlanes(min, max, sides = 8) {
  const cx = (min[0] + max[0]) / 2;
  const cz = (min[2] + max[2]) / 2;
  const rx = (max[0] - min[0]) / 2;
  const rz = (max[2] - min[2]) / 2;
  const planes = [
    { n: [0, 1, 0], d: max[1] },
    { n: [0, -1, 0], d: -min[1] },
  ];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const n = [Math.cos(a), 0, Math.sin(a)];
    const p = [cx + n[0] * rx, min[1], cz + n[2] * rz];
    planes.push(plane(n, p));
  }
  return planes;
}

export function brushToPlanes(brush) {
  const min = brush.min || [0, 0, 0];
  const max = brush.max || [1, 1, 1];
  switch (brush.type) {
    case 'ramp': return rampPlanes(min, max, brush.axis || 'x', brush.dir ?? 1, brush.low ?? null);
    case 'wedge': return wedgePlanes(min, max, brush.corner || 'nx-nz');
    case 'cylinder': return cylinderPlanes(min, max, brush.sides || 8);
    case 'planes': return (brush.planes || []).map((p) => ({ n: norm([p[0], p[1], p[2]]), d: p[3] }));
    case 'box':
    default: return boxPlanes(min, max);
  }
}

const VERTEX_EPS = 0.0015;

/**
 * Convert a halfspace intersection into renderable polygons. Every triple of
 * planes gives a candidate corner; corners outside any plane are discarded,
 * then each plane collects the corners lying on it and sorts them into a fan.
 */
export function planesToPolygons(planes) {
  const points = [];
  for (let i = 0; i < planes.length; i++) {
    for (let j = i + 1; j < planes.length; j++) {
      for (let k = j + 1; k < planes.length; k++) {
        const n1 = planes[i].n, n2 = planes[j].n, n3 = planes[k].n;
        const cross23 = cross(n2, n3);
        const denom = dot(n1, cross23);
        if (Math.abs(denom) < 1e-6) continue; // planes are parallel or collinear

        const p = [
          (planes[i].d * cross23[0] + planes[j].d * cross(n3, n1)[0] + planes[k].d * cross(n1, n2)[0]) / denom,
          (planes[i].d * cross23[1] + planes[j].d * cross(n3, n1)[1] + planes[k].d * cross(n1, n2)[1]) / denom,
          (planes[i].d * cross23[2] + planes[j].d * cross(n3, n1)[2] + planes[k].d * cross(n1, n2)[2]) / denom,
        ];

        let inside = true;
        for (const pl of planes) {
          if (dot(pl.n, p) - pl.d > VERTEX_EPS) { inside = false; break; }
        }
        if (inside) points.push(p);
      }
    }
  }

  const polygons = [];
  for (const pl of planes) {
    const onPlane = points.filter((p) => Math.abs(dot(pl.n, p) - pl.d) < VERTEX_EPS);
    if (onPlane.length < 3) continue;

    const center = onPlane.reduce((acc, p) => add(acc, p), [0, 0, 0]).map((c) => c / onPlane.length);
    let tangent = norm(sub(onPlane[0], center));
    if (len(tangent) < 0.5) continue;
    const bitangent = cross(pl.n, tangent);

    const unique = [];
    const sorted = onPlane
      .map((p) => {
        const v = sub(p, center);
        return { p, angle: Math.atan2(dot(v, bitangent), dot(v, tangent)) };
      })
      .sort((a, b) => a.angle - b.angle);

    // Coincident corners appear whenever more than three planes meet, which
    // happens on every box corner — dedupe or the fan degenerates.
    for (const item of sorted) {
      const last = unique[unique.length - 1];
      if (!last || Math.hypot(last[0] - item.p[0], last[1] - item.p[1], last[2] - item.p[2]) > VERTEX_EPS * 4) {
        unique.push(item.p);
      }
    }
    if (unique.length >= 3) polygons.push({ points: unique, normal: pl.n });
  }
  return polygons;
}

function boundsOfPolygons(polygons) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const poly of polygons) {
    for (const p of poly.points) {
      for (let i = 0; i < 3; i++) {
        if (p[i] < min[i]) min[i] = p[i];
        if (p[i] > max[i]) max[i] = p[i];
      }
    }
  }
  return { min, max };
}

export function resolveMaterials(map) {
  const list = (map.materials && map.materials.length) ? map.materials : DEFAULT_MATERIALS;
  const index = new Map();
  list.forEach((m, i) => index.set(m.name, i));
  return { list, index };
}

/**
 * Build everything the runtime needs from a map document: a collision world,
 * one static vertex buffer, and the level bounds used to fit the shadow map.
 */
export function buildMap(map) {
  const { list: materials, index: materialIndex } = resolveMaterials(map);
  const collision = new CollisionWorld();
  const mesh = new MeshBuilder();
  const triggerBrushes = [];

  for (const brush of map.brushes || []) {
    const planes = brushToPlanes(brush);
    if (!planes.length) continue;
    const polygons = planesToPolygons(planes);
    if (!polygons.length) continue;
    const bounds = boundsOfPolygons(polygons);

    const layer = materialIndex.get(brush.material) ?? 0;
    const tint = brush.tint || [1, 1, 1];
    const uvScale = brush.uvScale ?? 0.5;

    if (brush.trigger) {
      // Triggers are volumes, not geometry: no mesh, no collision, just a
      // region other systems test against.
      triggerBrushes.push({ planes, min: bounds.min, max: bounds.max, name: brush.name, brush });
      continue;
    }

    if (!brush.invisible) {
      for (const poly of polygons) {
        mesh.pushPolygon(poly.points, poly.normal, layer, tint, uvScale);
      }
    }
    if (!brush.nonSolid) {
      collision.addBrush(planes, bounds.min, bounds.max, { material: brush.material });
    }
  }

  collision.computeBounds();

  return {
    collision,
    meshData: mesh.toFloat32Array(),
    materials,
    materialIndex,
    triggerBrushes,
    bounds: collision.bounds,
    env: buildEnv(map),
    entities: map.entities || [],
    name: map.name || 'untitled',
    player: map.player || {},
  };
}

function buildEnv(map) {
  const sky = map.sky || {};
  return {
    skyColor: sky.color || [0.42, 0.53, 0.68],
    sunDir: sky.sunDir || [-0.45, -0.8, -0.35],
    sunColor: sky.sunColor || [1.0, 0.95, 0.86],
    ambient: sky.ambient || [0.3, 0.33, 0.4],
    fogColor: sky.fogColor || sky.color || [0.42, 0.53, 0.68],
    fogDensity: sky.fogDensity ?? 0.014,
    pointLights: [],
  };
}

export function pointInBrush(planes, point, epsilon = 0) {
  for (const pl of planes) {
    if (dot(pl.n, point) - pl.d > epsilon) return false;
  }
  return true;
}

export async function loadMap(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load map ${url}: ${res.status}`);
  return res.json();
}
