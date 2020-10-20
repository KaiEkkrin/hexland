import * as THREE from 'three';

// Utilities for transferring matrices (as column vectors) to shaders as
// instance attributes.

export class InstanceMatrix3Column {
  private readonly _column: Float32Array;
  private readonly _attr: THREE.InstancedBufferAttribute;

  constructor(maxInstances: number) {
    this._column = new Float32Array(maxInstances * 3);
    this._attr = new THREE.InstancedBufferAttribute(this._column, 3);
    this._attr.setUsage(THREE.DynamicDrawUsage);
  }

  get attr() { return this._attr; }

  fromMatrix4Column(m: THREE.Matrix4, col: number, instanceIndex: number) {
    // We ignore the Z element:
    this._column[instanceIndex * 3] = m.elements[col * 4];
    this._column[instanceIndex * 3 + 1] = m.elements[col * 4 + 1];
    this._column[instanceIndex * 3 + 2] = m.elements[col * 4 + 3];
    this.attr.needsUpdate = true;
  }
}

export function fromMatrix4Columns(
  instanceColumns: InstanceMatrix3Column[], m: THREE.Matrix4, instanceIndex: number
) {
  // We ignore the Z column:
  instanceColumns[0].fromMatrix4Column(m, 0, instanceIndex);
  instanceColumns[1].fromMatrix4Column(m, 1, instanceIndex);
  instanceColumns[2].fromMatrix4Column(m, 3, instanceIndex);
}