import { Drawn } from './drawn';
import { IGridGeometry } from './gridGeometry';
import { RedrawFlag } from './redrawFlag';

import * as THREE from 'three';

const gridZ = 1;

export class Grid extends Drawn {
  private readonly _alpha: number;
  private readonly _lineIndices: number[];
  private readonly _lineMaterial: THREE.LineBasicMaterial;
  private readonly _solidIndices: number[];
  private readonly _solidMaterial: THREE.MeshBasicMaterial;

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, alpha: number) {
    super(geometry, redrawFlag);
    this._alpha = alpha;
    this._lineIndices = geometry.createGridLineIndices();
    this._lineMaterial = new THREE.LineBasicMaterial({ color: 0xb0b0b0 });
    this._solidIndices = geometry.createSolidMeshIndices();
    this._solidMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, flatShading: true, vertexColors: true });
  }

  // Adds a grid to a scene.
  // `originX` and `originY` are tile co-ordinates of the central tile to create.
  // `radius` is the number of tiles away from the centre to draw in each direction.
  addGridToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    // TODO Keep these tiles?  Juggle them about?  Etc.
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var vertices = this.geometry.createGridVertices(new THREE.Vector2(x, y), gridZ);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._lineIndices);
        var lines = new THREE.Line(bufferGeometry, this._lineMaterial);
        scene.add(lines);
      }
    }
  }

  addSolidToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var vertices = this.geometry.createSolidVertices(new THREE.Vector2(x, y), 1.0, gridZ);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._solidIndices);

        var colours = this.geometry.createSolidTestColours();
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);
      }
    }
  }

  addCoordColoursToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var tile = new THREE.Vector2(x, y);
        var vertices = this.geometry.createSolidVertices(tile, 1.0, gridZ);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);
        bufferGeometry.setIndex(this._solidIndices);

        var colours = this.geometry.createSolidCoordColours(tile);
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);
      }
    }
  }

  addEdgeColoursToScene(scene: THREE.Scene, originX: number, originY: number, radius: number) {
    for (var y = originY - radius; y < originY + radius; ++y) {
      for (var x = originX - radius; x < originX + radius; ++x) {
        var tile = new THREE.Vector2(x, y);
        var vertices = this.geometry.createSolidEdgeVertices(tile, this._alpha, gridZ);
        var bufferGeometry = new THREE.BufferGeometry().setFromPoints(vertices);

        var colours = this.geometry.createSolidEdgeColours(tile);
        bufferGeometry.setAttribute('color', new THREE.BufferAttribute(colours, 3));

        var mesh = new THREE.Mesh(bufferGeometry, this._solidMaterial);
        scene.add(mesh);
      }
    }
  }
}
