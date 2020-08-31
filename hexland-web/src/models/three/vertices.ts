import { IGridVertex, vertexString } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { PaletteColouredFeatureObject, IColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export function createPaletteColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number, colourParameters: IColourParameters) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createSolidVertexVertices(new THREE.Vector2(0, 0), alpha, z, 1)];
  const indices = [...single.createSolidVertexIndices()];
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
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

export function createPaletteColouredVertices(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  alpha: number,
  z: number,
  colourParameters: IColourParameters,
  maxInstances?: number | undefined
) {
  return new InstancedFeatures<IGridVertex, IFeature<IGridVertex>, PaletteColouredFeatureObject<IGridVertex, IFeature<IGridVertex>>>(
    gridGeometry,
    needsRedraw,
    vertexString,
    createPaletteColouredVertexObject(gridGeometry, alpha, z, colourParameters),
    maxInstances
  );
}

export type Vertices = InstancedFeatures<IGridVertex, IFeature<IGridVertex>, PaletteColouredFeatureObject<IGridVertex, IFeature<IGridVertex>>>;