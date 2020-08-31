import { coordString, IGridCoord } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { PaletteColouredFeatureObject, IColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export function createPaletteColouredAreaObject(gridGeometry: IGridGeometry, alpha: number, areaZ: number, colourParameters: IColourParameters) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createSolidVertices(new THREE.Vector2(0, 0), alpha, areaZ)];
  const indices = [...single.createSolidMeshIndices()];
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    coordString,
    (o, p) => gridGeometry.transformToCoord(o, p),
    maxInstances,
    () => {
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setFromPoints(vertices);
      geometry.setIndex(indices);
      return geometry;
    },
    colourParameters
  );
}

export function createPaletteColouredAreas(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  alpha: number,
  z: number,
  colourParameters: IColourParameters,
  maxInstances?: number | undefined
) {
  return new InstancedFeatures<IGridCoord, IFeature<IGridCoord>, PaletteColouredFeatureObject<IGridCoord, IFeature<IGridCoord>>>(
    gridGeometry,
    needsRedraw,
    coordString,
    createPaletteColouredAreaObject(gridGeometry, alpha, z, colourParameters),
    maxInstances
  );
}

export type Areas = InstancedFeatures<IGridCoord, IFeature<IGridCoord>, PaletteColouredFeatureObject<IGridCoord, IFeature<IGridCoord>>>;