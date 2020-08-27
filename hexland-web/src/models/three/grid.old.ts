import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export class Grid extends Drawn {
  private readonly _z: number;
  private readonly _alpha: number;
  private readonly _vertexAlpha: number;
  private readonly _solidIndices: number[];
  private readonly _solidVertexIndices: number[];
  private readonly _solidMaterial: THREE.MeshBasicMaterial;

  private _geometries: THREE.BufferGeometry[] = []; // for disposal only

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, z: number, alpha: number, vertexAlpha: number) {
    super(geometry, redrawFlag);
    this._z = z;
    this._alpha = alpha;
    this._vertexAlpha = vertexAlpha;
    this._solidIndices = [...geometry.createSolidMeshIndices()];
    this._solidVertexIndices = [...geometry.createSolidVertexIndices()];
    this._solidMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  }

  addCoordColoursToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var tile = new THREE.Vector2(x, y);
        var vertices = [...this.geometry.createSolidVertices(tile, 1.0, this._z)];
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._solidIndices);

        var colours = this.geometry.createSolidCoordColours(tile);
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);

        this._geometries.push(bufferGeometry);
      }
    }
  }

  addEdgeColoursToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var tile = new THREE.Vector2(x, y);
        var vertices = this.geometry.createSolidEdgeVertices(tile, this._alpha, this._z);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);

        var colours = this.geometry.createSolidEdgeColours(tile);
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);

        this._geometries.push(bufferGeometry);
      }
    }
  }

  addVertexColoursToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var tile = new THREE.Vector2(x, y);
        var vertices = this.geometry.createSolidVertexVertices(tile, this._vertexAlpha, this._z);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._solidVertexIndices);

        var colours = this.geometry.createSolidVertexColours(tile);
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);

        this._geometries.push(bufferGeometry);
      }
    }
  }

  dispose() {
    this._solidMaterial.dispose();
    this._geometries.forEach(g => g.dispose());
  }
}