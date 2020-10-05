import { IGridEdge, edgeString } from '../../data/coord';
import { IFeature, IFeatureDictionary } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { MultipleFeatureObject } from './multipleFeatureObject';
import { PaletteColouredFeatureObject, IColourParameters, createSelectionColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';
import { IInstancedFeatureObject } from './instancedFeatureObject';

export function createTokenFillEdgeGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const vertices = [...gridGeometry.createTokenFillEdgeVertices(alpha, z)];
  const indices = gridGeometry.createTokenFillEdgeIndices();
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

export function createWallGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createWallVertices(alpha, z)];
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    return geometry;
  };
}

export function createPaletteColouredWallObject(createGeometry: () => THREE.InstancedBufferGeometry, gridGeometry: IGridGeometry, colourParameters: IColourParameters) {
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    edgeString,
    (o, p) => gridGeometry.transformToEdge(o, p),
    maxInstances,
    createGeometry,
    colourParameters
  );
}

export function createSelectionColouredWallObject(createGeometry: () => THREE.InstancedBufferGeometry, gridGeometry: IGridGeometry) {
  return (maxInstances: number) => new MultipleFeatureObject<IGridEdge, IFeature<IGridEdge>>(
    (i: number, maxInstances: number) => new PaletteColouredFeatureObject(
      edgeString,
      (o, p) => gridGeometry.transformToEdge(o, p),
      maxInstances,
      createGeometry,
      createSelectionColourParameters(i)
    ),
    f => f.colour,
    maxInstances
  );
}

export type Edges = InstancedFeatures<IGridEdge, IFeature<IGridEdge>>;

// The "walls" are the edges of the map that are coloured in one of our
// known colours.  To implement line-of-sight, we synchronise this object with
// the LoS features object.
export class Walls extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>> {
  private readonly _losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined;

  constructor(
    gridGeometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    createFeatureObject: (maxInstances: number) => IInstancedFeatureObject<IGridEdge, IFeature<IGridEdge>>,
    losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined,
    maxInstances?: number | undefined
  ) {
    super(
      gridGeometry,
      redrawFlag,
      edgeString,
      createFeatureObject,
      maxInstances
    );
    this._losFeatures = losFeatures;
  }

  add(f: IFeature<IGridEdge>) {
    if (super.add(f)) {
      this._losFeatures?.add({ position: f.position, colour: 0 });
      return true;
    }

    return false;
  }

  clear() {
    super.clear();
    this._losFeatures?.clear();
  }

  remove(oldPosition: IGridEdge) {
    let feature = super.remove(oldPosition);
    if (feature !== undefined) {
      this._losFeatures?.remove(oldPosition);
    }

    return feature;
  }
}