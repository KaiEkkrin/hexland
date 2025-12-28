import * as THREE from 'three';

// Represents a token's position and size for Line of Sight rendering.
// The centre is in world coordinates, and radius is the token's effective
// size in world units (for future soft shadow calculations).
export interface LoSPosition {
  centre: THREE.Vector3;  // World coordinates (x, y, z)
  radius: number;         // World space radius
}

// Helper to compare two LoSPosition arrays for equality
export function losPositionsEqual(a: LoSPosition[], b: LoSPosition[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!a[i].centre.equals(b[i].centre) || a[i].radius !== b[i].radius) {
      return false;
    }
  }
  return true;
}
