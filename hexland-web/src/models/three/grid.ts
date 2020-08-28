import { IGridCoord, coordString } from '../../data/coord';
import { IFeature, FeatureDictionary } from '../../data/feature';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { IGridBounds } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

// Represents the grid drawn on the map.
// I'm not going to draw this instanced because the colour of each face/vertex is a function
// of both the face co-ordinate (within the tile) and the tile co-ordinate, which would
// require an instance parameter (for the tile co-ordinate), which in turn would require a
// custom shader to create the final colour.  This feels like total overkill when all I'd be
// doing is saving a small number of draw calls (drawing tile-by-tile means there would never
// be all that many instances.)
// However, TODO #22 -- this issue implies doing it, at which point I could change the grid
// to be instanced too :)
class GridTile implements IFeature<IGridCoord> {
  private readonly _coord: IGridCoord;

  private readonly _coordGeometry: THREE.BufferGeometry;
  private readonly _vertexGeometry: THREE.BufferGeometry;

  private readonly _coordMesh: THREE.Mesh;
  private readonly _vertexMesh: THREE.Mesh;

  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    tile: THREE.Vector2,
    z: number,
    vertexAlpha: number,
    coordIndices: number[],
    vertexIndices: number[],
    coordMaterial: THREE.Material,
    vertexMaterial: THREE.Material
  ) {
    this._coord = { x: tile.x * geometry.tileDim, y: tile.y * geometry.tileDim };

    this._coordGeometry = new THREE.BufferGeometry()
      .setFromPoints([...geometry.createSolidVertices(tile, 1.0, z)]);
    this._coordGeometry.setIndex(coordIndices);
    this._coordGeometry.setAttribute('color', new THREE.BufferAttribute(
      geometry.createSolidCoordColours(tile), 3
    ));

    this._vertexGeometry = new THREE.BufferGeometry()
      .setFromPoints([...geometry.createSolidVertexVertices(tile, vertexAlpha, z)]);
    this._vertexGeometry.setIndex(vertexIndices);
    this._vertexGeometry.setAttribute('color', new THREE.BufferAttribute(
      geometry.createSolidVertexColours(tile), 3
    ));

    this._coordMesh = new THREE.Mesh(this._coordGeometry, coordMaterial);
    this._vertexMesh = new THREE.Mesh(this._vertexGeometry, vertexMaterial);
  }

  get position() { return this._coord; }
  get colour() { return 0; } // meaningless fulfilment of the contract :p

  addCoordMeshToScene(scene: THREE.Scene) {
    scene.add(this._coordMesh);
  }

  addVertexMeshToScene(scene: THREE.Scene) {
    scene.add(this._vertexMesh);
  }

  removeCoordMeshFromScene(scene: THREE.Scene) {
    scene.remove(this._coordMesh);
  }

  removeVertexMeshFromScene(scene: THREE.Scene) {
    scene.remove(this._vertexMesh);
  }

  dispose() {
    if (this._isDisposed === false) {
      this._coordGeometry.dispose();
      this._vertexGeometry.dispose();

      this._isDisposed = true;
    }
  }
}

export class Grid extends Drawn {
  private readonly _z: number;
  private readonly _vertexAlpha: number;

  private readonly _tiles: FeatureDictionary<IGridCoord, GridTile>;
  private readonly _temp: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

  private readonly _coordIndices: number[];
  private readonly _vertexIndices: number[];
  private readonly _material: THREE.MeshBasicMaterial;
  private readonly _coordScene: THREE.Scene;
  private readonly _vertexScene: THREE.Scene;

  private _isDisposed = false;

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    z: number,
    vertexAlpha: number,
    coordScene: THREE.Scene,
    vertexScene: THREE.Scene
  ) {
    super(geometry, redrawFlag);
    this._z = z;
    this._vertexAlpha = vertexAlpha;

    this._tiles = new FeatureDictionary<IGridCoord, GridTile>(coordString);
    this._temp = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);

    this._coordIndices = [...geometry.createSolidMeshIndices()];
    this._vertexIndices = [...geometry.createSolidVertexIndices()];
    this._material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      flatShading: true,
      vertexColors: true
    });

    this._coordScene = coordScene;
    this._vertexScene = vertexScene;
  }

  // Extends the grid across the given range of tiles.
  // Returns the number of new tiles added.
  extendAcrossRange(bounds: IGridBounds) {
    var count = 0;
    var tileXy = new THREE.Vector2();
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        if (this._tiles.get(position) === undefined) {
          tileXy.set(s, t);
          var newTile = new GridTile(
            this.geometry, tileXy, this._z, this._vertexAlpha, this._coordIndices, this._vertexIndices,
            this._material, this._material
          );
          newTile.addCoordMeshToScene(this._coordScene);
          newTile.addVertexMeshToScene(this._vertexScene);
          this._tiles.add(newTile);
          this.setNeedsRedraw();
          ++count;
        }
      }
    }

    return count;
  }

  // Makes sure this range is filled and removes all tiles outside it.
  shrinkToRange(bounds: IGridBounds) {
    this.extendAcrossRange(bounds);

    // Fill the temp dictionary with entries for every tile we want to keep
    this._temp.clear();
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        this._temp.add({ position: position, colour: 0 });
      }
    }

    // Remove everything outside the range
    const toDelete: GridTile[] = [];
    for (var tile of this._tiles) {
      if (this._temp.get(tile.position) === undefined) {
        toDelete.push(tile);
      }
    }

    toDelete.forEach(tile => {
      tile.removeCoordMeshFromScene(this._coordScene);
      tile.removeVertexMeshFromScene(this._vertexScene);
      tile.dispose();
      this._tiles.remove(tile.position);
      this.setNeedsRedraw();
    });
  }

  dispose() {
    if (this._isDisposed === false) {
      for (var t of this._tiles) {
        t.removeCoordMeshFromScene(this._coordScene);
        t.removeVertexMeshFromScene(this._vertexScene);
        t.dispose();
      }

      this._material.dispose();
      this._isDisposed = true;
    }
  }
}