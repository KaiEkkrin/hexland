import * as THREE from 'three';
import { IGridGeometry } from './gridGeometry';
import { GridCoord } from '../data/coord';

// Describes how to test for being within an any-angle rectangle.
export class RectangleOcclusion {
  private readonly _planes: PlanarOcclusion[];

  // Construct it with the four points of a rectangle, winding around it.
  // (If you use a number of points other than four it will do weird stuff...)
  constructor(epsilon: number, points: THREE.Vector3[]) {
    this._planes = points.map((p, i) => {
      let next = points[(i + 1) % points.length];
      return new PlanarOcclusion(
        next.clone().sub(p).normalize(),
        p,
        epsilon
      );
    });
  }

  test(point: THREE.Vector3) {
    for (let p of this._planes) {
      if (!p.test(point)) {
        return false;
      }
    }

    return true;
  }
}

class PlanarOcclusion {
  private readonly _norm: THREE.Vector3;
  private readonly _min: number;

  constructor(norm: THREE.Vector3, point: THREE.Vector3, epsilon: number) {
    this._norm = norm;
    this._min = norm.dot(point) - epsilon;
  }

  test(point: THREE.Vector3) {
    const dot = this._norm.dot(point);
    //console.log("dot = " + dot + "; min = " + this._min);
    return dot >= this._min;
  }
}

// This helper wraps a set of occlusion test vertices and lets you
// transform them around.
export class TestVertexCollection {
  private readonly _geometry: IGridGeometry;
  private readonly _z: number;
  
  // We use this as scratch
  private readonly _vertices: THREE.Vector3[] = [];
  private readonly _scratch = new THREE.Vector3();

  // We never modify this
  private readonly _atZero: THREE.Vector3[] = [];
  private readonly _atOrigin: THREE.Vector3;

  constructor(geometry: IGridGeometry, z: number, alpha: number) {
    this._geometry = geometry;
    this._z = z;

    for (let v of geometry.createOcclusionTestVertices(
      { x: 0, y: 0 }, z, alpha
    )) {
      this._atZero.push(v);
      this._vertices.push(v.clone());
    }

    this._atOrigin = this._atZero[0]; // a bit cheating, assuming this is the middle :)
  }

  get count() { return this._vertices.length; }

  // Enumerates all the vertices at the given coord.
  // The memory yielded will be valid until another enumeration is done.
  *enumerate(coord: GridCoord) {
    this._geometry.createCoordCentre(this._scratch, coord, this._z * 2).sub(this._atOrigin);
    for (let i = 0; i < this._vertices.length; ++i) {
      this._vertices[i].copy(this._atZero[i]).add(this._scratch);
      yield this._vertices[i];
    }
  }
}