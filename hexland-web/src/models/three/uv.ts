import * as THREE from 'three';

// Creates UVs across the given object, preserving aspect ratio
export function *createBoundingUvs(vertices: THREE.Vector3[]): Iterable<number> {
  if (vertices.length === 0) {
    return;
  }

  const min = new THREE.Vector3(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
  const max = new THREE.Vector3(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER);
  for (const v of vertices) {
    min.min(v);
    max.max(v);
  }

  const offset = new THREE.Vector2(min.x, min.y);
  const scale1 = Math.max(max.x - min.x, max.y - min.y);
  const scale2 = Math.min(max.x - min.x, max.y - min.y);

  // Jiggle the offset about so that the UVs are centred in the smaller dimension
  if (max.x - min.x < max.y - min.y) {
    offset.setX(offset.x + 0.5 * (scale2 - scale1));
  } else {
    offset.setY(offset.y + 0.5 * (scale2 - scale1));
  }

  for (const v of vertices) {
    const s = (v.x - offset.x) / scale1;
    const t = (v.y - offset.y) / scale1;
    yield s;
    yield t;
  }
}