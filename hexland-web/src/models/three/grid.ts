import { IGridCoord, coordString, IGridVertex, vertexString } from '../../data/coord';
import { IFeature, FeatureDictionary } from '../../data/feature';
import { createAreaGeometry, Areas, createAreas } from './areas';
import { Drawn } from '../drawn';
import { IGridGeometry } from '../gridGeometry';
import { InstancedFeatureObject } from './instancedFeatureObject';
import { IGridBounds } from '../interfaces';
import { RedrawFlag } from '../redrawFlag';
import { createVertexGeometry, Vertices, createVertices } from './vertices';

import * as THREE from 'three';
import fluent from 'fluent-iterable';

// This shading provides the colouring for the coord and vertex colour textures, which
// aren't shown to the user (they look rainbow...) but let us look up a client position
// and get grid co-ordinates.
// Each instance is a whole tile (otherwise we would have to prepare too many vertices...)
// The code in the vertex shader should create the same format as `toPackedXYAbs` and
// `toPackedXYEdge` in GridGeometry.
const epsilon = "epsilon";
const maxEdge = "maxEdge";
const tileDim = "tileDim";
const gridColouredShader = {
  uniforms: {
    epsilon: { type: 'f', value: null },
    maxEdge: { type: 'f', value: null },
    tileDim: { type: 'f', value: null },
  },
  vertexShader: [
    "uniform float epsilon;",
    "uniform float maxEdge;",
    "uniform float tileDim;",
    "attribute vec3 face;", // per-vertex; z is the edge or vertex number
    "attribute vec2 tile;", // per-instance
    "varying vec3 vertexColour;", // packed colour

    "float packXYAbs(const in vec2 c) {",
    "  return epsilon + (abs(c.y) * tileDim + abs(c.x)) / (tileDim * tileDim);",
    "}",

    "float packXYSignAndEdge(const in vec2 c, const in float edge) {",
    "  float packed = (",
    "    (c.x < 0.0 ? 1.0 : 0.0) +",
    "    (c.y < 0.0 ? 2.0 : 0.0) +",
    "    4.0 * edge +",
    "    4.0 * maxEdge",
    "  );",
    "  return epsilon + packed / (8.0 * maxEdge);",
    "}",

    "void main() {",
    "  vertexColour = vec3(",
    "    packXYAbs(tile),",
    "    packXYSignAndEdge(tile, face.z),",
    "    packXYAbs(face.xy)",
    "  );",
    "  gl_Position = projectionMatrix * viewMatrix * instanceMatrix * vec4(position, 1.0);",
    "}"
  ].join("\n"),
  fragmentShader: [
    "varying vec3 vertexColour;",
    "void main() {",
    "  gl_FragColor = vec4(vertexColour, 1.0);",
    "}"
  ].join("\n")
};

class GridColouredFeatureObject<K extends IGridCoord, F extends IFeature<K>> extends InstancedFeatureObject<K, F> {
  private readonly _tileDim: number;
  private readonly _geometry: THREE.InstancedBufferGeometry;
  private readonly _material: THREE.ShaderMaterial;
  private readonly _uniforms: any;
  private readonly _tileAttr: THREE.InstancedBufferAttribute;
  private readonly _instanceTiles: Float32Array;

  constructor(
    toIndex: (k: K) => string,
    transformTo: (o: THREE.Object3D, position: K) => void,
    gridGeometry: IGridGeometry,
    maxInstances: number,
    createGeometry: () => THREE.InstancedBufferGeometry
  ) {
    super(toIndex, transformTo, maxInstances);
    this._tileDim = gridGeometry.tileDim;
    this._geometry = createGeometry();

    this._uniforms = THREE.UniformsUtils.clone(gridColouredShader.uniforms);
    this._uniforms[epsilon].value = gridGeometry.epsilon;
    this._uniforms[maxEdge].value = gridGeometry.maxEdge;
    this._uniforms[tileDim].value = gridGeometry.tileDim;

    this._material = new THREE.ShaderMaterial({
      uniforms: this._uniforms,
      vertexShader: gridColouredShader.vertexShader,
      fragmentShader: gridColouredShader.fragmentShader
    });

    this._instanceTiles = new Float32Array(maxInstances * 2);
    this._tileAttr = new THREE.InstancedBufferAttribute(this._instanceTiles, 2);
    this._tileAttr.setUsage(THREE.DynamicDrawUsage);
    this._geometry.setAttribute('tile', this._tileAttr);
  }

  protected createMesh(maxInstances: number) {
    return new THREE.InstancedMesh(this._geometry, this._material, maxInstances);
  }

  protected addFeature(f: F, instanceIndex: number) {
    super.addFeature(f, instanceIndex);

    // The positions are in grid coords, of course, not tile coords -- convert them here
    this._instanceTiles[2 * instanceIndex] = Math.floor(f.position.x / this._tileDim);
    this._instanceTiles[2 * instanceIndex + 1] = Math.floor(f.position.y / this._tileDim);
    this._tileAttr.needsUpdate = true;
  }

  dispose() {
    super.dispose();
    this._geometry.dispose();
    this._material.dispose();
  }
}

function createGridAreaGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const createGeometry = createAreaGeometry(gridGeometry, alpha, z);
  const faceAttrs = gridGeometry.createFaceAttributes();
  return () => {
    const geometry = createGeometry();
    geometry.setAttribute('face', new THREE.BufferAttribute(faceAttrs, 3));
    return geometry;
  }
}

function createGridVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const createGeometry = createVertexGeometry(gridGeometry, alpha, z);
  const vertexAttrs = gridGeometry.createVertexAttributes();
  return () => {
    const geometry = createGeometry();
    geometry.setAttribute('face', new THREE.BufferAttribute(vertexAttrs, 3));
    return geometry;
  }
}

function createGridColouredAreaObject(gridGeometry: IGridGeometry, z: number) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridCoord, IFeature<IGridCoord>>(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    gridGeometry,
    maxInstances,
    createGridAreaGeometry(gridGeometry, 1.0, z)
  );
}

function createGridColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number) {
  return (maxInstances: number) => new GridColouredFeatureObject<IGridVertex, IFeature<IGridVertex>>(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
    gridGeometry,
    maxInstances,
    createGridVertexGeometry(gridGeometry, alpha, z)
  );
}

export class Grid extends Drawn {
  private readonly _faces: Areas;
  private readonly _vertices: Vertices;

  private readonly _temp: FeatureDictionary<IGridCoord, IFeature<IGridCoord>>;

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

    this._faces = createAreas(
      geometry,
      redrawFlag,
      createGridColouredAreaObject(geometry, z),
      100
    );
    this._faces.addToScene(coordScene);

    this._vertices = createVertices(
      geometry,
      redrawFlag,
      createGridColouredVertexObject(geometry, vertexAlpha, z),
      100
    );
    this._vertices.addToScene(vertexScene);

    this._temp = new FeatureDictionary<IGridCoord, IFeature<IGridCoord>>(coordString);
  }

  // Extends the grid across the given range of tiles.
  // Returns the number of new tiles added.
  extendAcrossRange(bounds: IGridBounds) {
    var count = 0;
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        if (this._faces.get(position) === undefined) {
          this._faces.add({ position: position, colour: 0 });
          ++count;
        }

        var vertexPosition = { x: position.x, y: position.y, vertex: 0 };
        if (this._vertices.get(vertexPosition) === undefined) {
          this._vertices.add({ position: vertexPosition, colour: 0 });
        }
      }
    }

    // TODO #52 remove debug
    if (count > 0) {
      console.log("extended grid to " + fluent(this._faces).count() + " tiles");
    }

    return count;
  }

  // Makes sure this range is filled and removes all tiles outside it.
  shrinkToRange(bounds: IGridBounds) {
    const added = this.extendAcrossRange(bounds);

    // Fill the temp dictionary with entries for every tile we want to keep
    this._temp.clear();
    for (var t = bounds.minT; t <= bounds.maxT; ++t) {
      for (var s = bounds.minS; s <= bounds.maxS; ++s) {
        var position = { x: s * this.geometry.tileDim, y: t * this.geometry.tileDim };
        this._temp.add({ position: position, colour: 0 });
      }
    }

    // Remove everything outside the range.  Assume the faces and vertices are matching
    // (they should be!)
    const toDelete: IGridCoord[] = [];
    for (var face of this._faces) {
      if (this._temp.get(face.position) === undefined) {
        toDelete.push(face.position);
      }
    }

    toDelete.forEach(face => {
      this._faces.remove(face);
      this._vertices.remove({ x: face.x, y: face.y, vertex: 0 });
      this.setNeedsRedraw();
    });

    // TODO #52 remove debug
    if (added !== 0 || toDelete.length !== 0) {
      console.log("shrunk grid to " + fluent(this._faces).count() + " tiles");
    }
  }

  dispose() {
    if (this._isDisposed === false) {
      this._faces.dispose();
      this._vertices.dispose();
      this._isDisposed = true;
    }
  }
}