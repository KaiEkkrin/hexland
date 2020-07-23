import * as THREE from 'three';

export function lerp(a: THREE.Vector3, b: THREE.Vector3, alpha: number): THREE.Vector3 {
  // This, because it looks like the THREE lerp() function is bugged in the
  // release that I have :/
  return new THREE.Vector3(
    a.x * (1.0 - alpha) + b.x * alpha,
    a.y * (1.0 - alpha) + b.y * alpha,
    a.z * (1.0 - alpha) + b.z * alpha
  );
}

export function modFloor(a: number, b: number): number {
  var mod = a % b;
  return mod >= 0 ? mod : mod + b;
}