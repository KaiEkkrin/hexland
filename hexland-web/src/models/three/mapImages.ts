import { IdDictionary, IIdDictionary } from "../../data/identified";
import { Anchor, IMapControlPoint, IMapControlPointDictionary, IMapControlPointIdentifier, IMapImage } from "../../data/image";
import { ICacheLease } from "../../services/interfaces";
import { Drawn } from "../drawn";
import { IGridGeometry } from "../gridGeometry";
import { RedrawFlag } from "../redrawFlag";
import { TextureCache } from "./textureCache";

import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { vertexString } from "../../data/coord";
import { InstanceCountedMesh } from "./instancedFeatureObject";

// Internally, we file these objects, additionally containing the material
// and mesh so that we can manage cleanup
type MapImage = IMapImage & {
  sub: Subscription; // Subscription to the async operation of resolving and adding the texture
};

type MeshRecord = {
  material: THREE.MeshBasicMaterial;
  mesh: THREE.Mesh;
  lease: ICacheLease<THREE.Texture>;
};

const zAxis = new THREE.Vector3(0, 0, 1);

function createSelectionMaterial() {
  return new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: 0x606060,
    side: THREE.DoubleSide,
    transparent: true
  });
}

function createInvalidSelectionMaterial() {
  return new THREE.MeshBasicMaterial({
    blending: THREE.AdditiveBlending,
    color: 0x600000,
    side: THREE.DoubleSide,
    transparent: true
  });
}

function createSquareBufferGeometry(z: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, z),
    new THREE.Vector3(1, 0, z),
    new THREE.Vector3(0, 1, z),
    new THREE.Vector3(1, 1, z)
  ]);
  g.setIndex([
    0, 1, 2, 1, 2, 3
  ]);
  return g;
}

function positionMesh(gridGeometry: IGridGeometry, mesh: THREE.Mesh, image: IMapImage) {
  const start = gridGeometry.createAnchorPosition(mesh.position, image.start);
  gridGeometry.createAnchorPosition(mesh.scale, image.end).sub(start).add(zAxis);
  mesh.updateMatrix();
  mesh.updateMatrixWorld();
}

// The map images can draw into the main canvas, but because the objects are
// dynamic (there's one draw call per image), they need to be in a separate
// scene that is rendered before the objects (so that area alpha blending
// applies correctly, etc.)
export class MapImages extends Drawn implements IIdDictionary<IMapImage> {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _scene: THREE.Scene; // we don't own this
  private readonly _values = new Map<string, MapImage>();
  private readonly _meshes = new Map<string, MeshRecord>(); // id -> mesh added to scene

  private _textureCache: TextureCache; // we don't own this either

  constructor(
    geometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    scene: THREE.Scene,
    textureCache: TextureCache,
    z: number
  ) {
    super(geometry, redrawFlag);

    // This is a simple square at [0..1]
    this._bufferGeometry = createSquareBufferGeometry(z);

    // ...with the UVs inverted in Y, since we draw with 0 at the top
    this._bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0, 1, 1, 1, 0, 0, 1, 0
    ]), 2));

    this._scene = scene;
    this._textureCache = textureCache;
  }

  private addMesh(f: IMapImage, lease: ICacheLease<THREE.Texture>) {
    if (this._meshes.get(f.id) !== undefined) {
      lease.release();
      return;
    }

    const material = new THREE.MeshBasicMaterial({
      blending: THREE.NormalBlending,
      map: lease.value,
      side: THREE.DoubleSide,
      transparent: true
    });
    const mesh = new THREE.Mesh(this._bufferGeometry, material);
    positionMesh(this.geometry, mesh, f);

    this._scene.add(mesh);
    this._meshes.set(f.id, { lease: lease, material: material, mesh: mesh });
    this.setNeedsRedraw();
  }

  [Symbol.iterator](): Iterator<IMapImage> {
    return this.iterate();
  }

  add(f: IMapImage) {
    if (this._values.has(f.id)) {
      return false;
    }

    // Resolve the texture.  When we have, add the relevant mesh:
    const sub = this._textureCache.resolveImage(f.image).subscribe(
      l => this.addMesh(f, l)
    );
    this._values.set(f.id, { ...f, sub: sub });
    return true;
  }

  clear() {
    // Removing everything individually lets us also remove objects from the scene
    const toRemove = [...this.iterate()];
    toRemove.forEach(f => this.remove(f.id));
  }

  clone(): IIdDictionary<IMapImage> {
    return new IdDictionary<IMapImage>(this._values);
  }

  forEach(fn: (f: IMapImage) => void) {
    this._values.forEach(fn);
  }

  get(k: string): IMapImage | undefined {
    return this._values.get(k);
  }

  *iterate() {
    for (const v of this._values) {
      yield v[1];
    }
  }

  remove(k: string): IMapImage | undefined {
    const value = this._values.get(k);
    if (value !== undefined) {
      // If we're still waiting for a texture, stop that
      value.sub.unsubscribe();

      // Remove and clean up any texture we did receive
      const r = this._meshes.get(value.id);
      if (r !== undefined) {
        this._scene.remove(r.mesh);
        r.material.dispose();
        r.lease.release().then(() => { /* should be okay to let go */ });
        this._meshes.delete(value.id);
        this.setNeedsRedraw();
      }

      this._values.delete(k);
      return value;
    }

    return undefined;
  }

  setTextureCache(textureCache: TextureCache) {
    // Changing this invalidates anything we currently have
    this.clear();
    this._textureCache = textureCache;
  }

  dispose() {
    this.clear(); // will also cleanup leases, materials etc.
    this._bufferGeometry.dispose();
  }
}

type SelectedMapImage = IMapImage & {
  mesh: THREE.Mesh;
};

// This really simple wrapper contains the map image selection.
// We don't bother with instancing for now; it's unlikely many map images will
// be selected at once (I hope.)
export class MapImageSelection extends Drawn implements IIdDictionary<IMapImage> {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _material: THREE.Material; // this is common
  private readonly _scene: THREE.Scene; // we don't own this
  private readonly _values = new Map<string, SelectedMapImage>();

  constructor(geometry: IGridGeometry, redrawFlag: RedrawFlag, scene: THREE.Scene, z: number) {
    super(geometry, redrawFlag);
    this._bufferGeometry = createSquareBufferGeometry(z);

    this._material = createSelectionMaterial();
    this._scene = scene;
  }

  [Symbol.iterator](): Iterator<IMapImage> {
    return this.iterate();
  }

  add(f: IMapImage) {
    if (this._values.has(f.id)) {
      return false;
    }

    // Create and add a mesh representing this image selected
    const mesh = new THREE.Mesh(this._bufferGeometry, this._material);
    positionMesh(this.geometry, mesh, f);
    this._scene.add(mesh);
    this._values.set(f.id, { ...f, mesh: mesh });
    this.setNeedsRedraw();
    return true;
  }

  clear() {
    // Removing everything individually lets us also remove objects from the scene
    const toRemove = [...this.iterate()];
    toRemove.forEach(f => this.remove(f.id));
  }

  clone(): IIdDictionary<IMapImage> {
    return new IdDictionary<IMapImage>(this._values);
  }

  forEach(fn: (f: IMapImage) => void) {
    this._values.forEach(fn);
  }

  get(k: string): IMapImage | undefined {
    return this._values.get(k);
  }

  *iterate() {
    for (const v of this._values) {
      yield v[1];
    }
  }

  remove(k: string): IMapImage | undefined {
    const value = this._values.get(k);
    if (value !== undefined) {
      console.log(`removing selection ${k}`);
      this._scene.remove(value.mesh);
      this.setNeedsRedraw();
      this._values.delete(k);
      return value;
    }

    return undefined;
  }

  dispose() {
    this.clear(); // will also cleanup leases, materials etc.
    this._bufferGeometry.dispose();
    this._material.dispose();
  }
}

// The image control points are drawn like selected vertices at the "start" and "end" positions.
// Because the geometry is instanced, we implement something similar to the InstancedFeatureObject;
// for now, we don't support expand beyond the initial maxInstances, because it's super unlikely
// to end up with many of these (multi-resize doesn't make sense...)
export class MapControlPoints extends Drawn implements IMapControlPointDictionary {
  private readonly _bufferGeometry: THREE.BufferGeometry;
  private readonly _material: THREE.Material;
  private readonly _invalidMaterial: THREE.Material;
  private readonly _mesh: InstanceCountedMesh;
  private readonly _invalidMesh: InstanceCountedMesh;
  private readonly _scene: THREE.Scene; // we don't own this
  private readonly _values = new Map<string, IMapControlPoint & { index: number }>();

  constructor(
    gridGeometry: IGridGeometry, redrawFlag: RedrawFlag,
    scene: THREE.Scene,
    alpha: number, z: number, maxInstances?: number | undefined
  ) {
    super(gridGeometry, redrawFlag);

    const single = gridGeometry.toSingle();
    const vertices = [...single.createSolidVertexVertices(new THREE.Vector2(0, 0), alpha, z, 1)];
    const indices = [...single.createSolidVertexIndices()];
    this._bufferGeometry = new THREE.BufferGeometry();
    this._bufferGeometry.setFromPoints(vertices);
    this._bufferGeometry.setIndex(indices);

    this._material = createSelectionMaterial();
    this._invalidMaterial = createInvalidSelectionMaterial();
    this._mesh = new InstanceCountedMesh(
      maxInstances ?? 100,
      maxInstances => new THREE.InstancedMesh(this._bufferGeometry, this._material, maxInstances)
    );
    this._invalidMesh = new InstanceCountedMesh(
      maxInstances ?? 100,
      maxInstances => new THREE.InstancedMesh(this._bufferGeometry, this._invalidMaterial, maxInstances)
    );

    this._scene = scene;
    scene.add(this._mesh.mesh);
    scene.add(this._invalidMesh.mesh);
  }

  private toKey(id: IMapControlPointIdentifier) {
    return `${id.id} ${id.which}`;
  }

  private transformToAnchor(m: THREE.Matrix4, a: Anchor): THREE.Matrix4 {
    switch (a.anchorType) {
      case 'vertex':
        console.log(`drawing control point at ${vertexString(a.position)}`);
        return this.geometry.transformToVertex(m, a.position);

      default:
        // TODO #135 Fill this in a bit later
        throw Error(`Unsupported anchor type: ${a.anchorType}`);
    }
  }

  [Symbol.iterator]() {
    return this.iterate();
  }

  add(f: IMapControlPoint) {
    const key = this.toKey(f);
    if (this._values.get(key) !== undefined) {
      return false;
    }

    const m = this.transformToAnchor(new THREE.Matrix4(), f.anchor);
    const target = f.invalid === true ? this._invalidMesh : this._mesh;
    const instanceIndex = target.addInstance(m);
    if (instanceIndex === undefined) {
      return false;
    }

    this.setNeedsRedraw();
    this._values.set(key, { ...f, index: instanceIndex });
    return true;
  }

  clear() {
    this._values.clear();
    this._mesh.clear();
    this._invalidMesh.clear();
  }

  forEach(fn: (f: IMapControlPoint) => void) {
    this._values.forEach(fn);
  }

  get(id: IMapControlPointIdentifier) {
    return this._values.get(this.toKey(id));
  }

  *iterate() {
    for (const v of this._values) {
      yield v[1];
    }
  }

  remove(id: IMapControlPointIdentifier) {
    const key = this.toKey(id);
    const value = this._values.get(key);
    if (value === undefined) {
      return undefined;
    }

    (value.invalid === true ? this._invalidMesh : this._mesh).removeInstance(value.index);
    this.setNeedsRedraw();
    this._values.delete(key);
    return value;
  }

  dispose() {
    this._scene.remove(this._mesh.mesh);
    this._scene.remove(this._invalidMesh.mesh);
    this._bufferGeometry.dispose();
    this._material.dispose();
    this._invalidMaterial.dispose();
  }
}