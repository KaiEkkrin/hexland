import * as THREE from 'three';

// Describes how to test for occlusion behind an edge as seen from a coord.

export class EdgeOcclusion {
  private readonly _front: PlanarOcclusion;
  private readonly _sideA: PlanarOcclusion;
  private readonly _sideB: PlanarOcclusion;

  constructor(seenFrom: THREE.Vector3, edgeA: THREE.Vector3, edgeB: THREE.Vector3, epsilon: number) {
    // Find out which way round this thing is
    const chirality = Math.sign(edgeA.clone().sub(seenFrom).cross(edgeB.clone().sub(seenFrom)).z);

    // `edgeNorm` needs to be perpendicular to `edgeA->edgeB` and facing away from `seenFrom`
    const edgeCentre = edgeA.clone().lerp(edgeB, 0.5);
    const edgeNorm = edgeA.clone().sub(edgeB.clone())
      .applyAxisAngle(new THREE.Vector3(0, 0, chirality), Math.PI * 0.5).normalize();
    this._front = new PlanarOcclusion(edgeNorm, edgeCentre, epsilon);

    // `edgeANorm` needs to be turning from `seenFrom->edgeA` to `seenFrom->edgeB`
    const edgeANorm = edgeA.clone().sub(seenFrom)
      .applyAxisAngle(new THREE.Vector3(0, 0, chirality), Math.PI * 0.5).normalize();
    this._sideA = new PlanarOcclusion(edgeANorm, edgeA, epsilon);

    // Similarly, `edgeBNorm` needs to be turning from `seenFrom->edgeB` to `seenFrom->edgeA`
    const edgeBNorm = edgeB.clone().sub(seenFrom)
      .applyAxisAngle(new THREE.Vector3(0, 0, chirality), Math.PI * 1.5).normalize();
    this._sideB = new PlanarOcclusion(edgeBNorm, edgeB, epsilon);

    // TODO remove all debug
    // console.log("***");
    // console.log("seenFrom = " + seenFrom.toArray());
    // console.log("edgeCentre = " + edgeCentre.toArray());
    // console.log("chirality = " + chirality);
    // console.log("edgeNorm = " + edgeNorm.toArray());
    // console.log("edgeA = " + edgeA.toArray());
    // console.log("edgeANorm = " + edgeANorm.toArray());
    // console.log("edgeB = " + edgeB.toArray());
    // console.log("edgeBNorm = " + edgeBNorm.toArray());
    // console.log("epsilon = " + epsilon);
  }

  test(point: THREE.Vector3) {
    return this._front.test(point) && this._sideA.test(point) && this._sideB.test(point);
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
    // console.log("dot = " + dot + "; min = " + this._min);
    return dot >= this._min;
  }
}