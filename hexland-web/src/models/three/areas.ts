import { coordString, IGridCoord } from '../../data/coord';
import { IFeature, IIdFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { IInstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { MultipleFeatureObject } from './multipleFeatureObject';
import { PaletteColouredFeatureObject, IColourParameters, createSelectionColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export function createAreaGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const vertices = [...gridGeometry.createSolidVertices(new THREE.Vector2(0, 0), alpha, z)];
  const indices = [...gridGeometry.createSolidMeshIndices()];
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

function createSingleAreaGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  return createAreaGeometry(gridGeometry.toSingle(), alpha, z);
}

export function createPaletteColouredAreaObject(gridGeometry: IGridGeometry, alpha: number, areaZ: number, colourParameters: IColourParameters) {
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    maxInstances,
    createSingleAreaGeometry(gridGeometry, alpha, areaZ),
    colourParameters
  );
}

export function createSelectionColouredAreaObject(gridGeometry: IGridGeometry, alpha: number, areaZ: number) {
  const areaGeometry = createSingleAreaGeometry(gridGeometry, alpha, areaZ);
  return (maxInstances: number) => new MultipleFeatureObject<IGridCoord, IFeature<IGridCoord>>(
    (i: number, maxInstances: number) => new PaletteColouredFeatureObject(
      coordString,
      (o, p) => gridGeometry.transformToCoord(o, p),
      maxInstances,
      areaGeometry,
      createSelectionColourParameters(i)
    ),
    f => f.colour,
    maxInstances
  );
}

export function createAreas(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  createFeatureObject: (maxInstances: number) => IInstancedFeatureObject<IGridCoord, IFeature<IGridCoord>>,
  maxInstances?: number | undefined
) {
  return new InstancedFeatures<IGridCoord, IFeature<IGridCoord>>(
    gridGeometry, needsRedraw, coordString, createFeatureObject, maxInstances
  );
}

export function createSelectedAreas(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  createFeatureObject: (maxInstances: number) => IInstancedFeatureObject<IGridCoord, IIdFeature<IGridCoord>>,
  maxInstances?: number | undefined
) {
  return new InstancedFeatures<IGridCoord, IIdFeature<IGridCoord>>(
    gridGeometry, needsRedraw, coordString, createFeatureObject, maxInstances
  );
}

export type Areas = InstancedFeatures<IGridCoord, IFeature<IGridCoord>>;
export type SelectedAreas = InstancedFeatures<IGridCoord, IIdFeature<IGridCoord>>; // so we can look up which token was selected