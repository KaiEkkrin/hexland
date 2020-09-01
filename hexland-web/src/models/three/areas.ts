import { coordString, IGridCoord } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { IInstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { MultipleFeatureObject } from './multipleFeatureObject';
import { PaletteColouredFeatureObject, IColourParameters, createSelectionColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

function createAreaGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createSolidVertices(new THREE.Vector2(0, 0), alpha, z)];
  const indices = [...single.createSolidMeshIndices()];
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

export function createPaletteColouredAreaObject(gridGeometry: IGridGeometry, alpha: number, areaZ: number, colourParameters: IColourParameters) {
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    maxInstances,
    createAreaGeometry(gridGeometry, alpha, areaZ),
    colourParameters
  );
}

export function createSelectionColouredAreaObject(gridGeometry: IGridGeometry, alpha: number, areaZ: number) {
  const areaGeometry = createAreaGeometry(gridGeometry, alpha, areaZ);
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

export type Areas = InstancedFeatures<IGridCoord, IFeature<IGridCoord>>;