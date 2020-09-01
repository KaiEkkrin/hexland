import { IGridVertex, vertexString } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { IInstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { MultipleFeatureObject } from './multipleFeatureObject';
import { PaletteColouredFeatureObject, IColourParameters, createSelectionColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

function createVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createSolidVertexVertices(new THREE.Vector2(0, 0), alpha, z, 1)];
  const indices = [...single.createSolidVertexIndices()];
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

export function createPaletteColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number, colourParameters: IColourParameters) {
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
    maxInstances,
    createVertexGeometry(gridGeometry, alpha, z),
    colourParameters
  );
}

export function createSelectionColouredVertexObject(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const vertexGeometry = createVertexGeometry(gridGeometry, alpha, z);
  return (maxInstances: number) => new MultipleFeatureObject<IGridVertex, IFeature<IGridVertex>>(
    (i: number, maxInstances: number) => new PaletteColouredFeatureObject(
      vertexString,
      (o, p) => gridGeometry.transformToVertex(o, p),
      maxInstances,
      vertexGeometry,
      createSelectionColourParameters(i)
    ),
    f => f.colour,
    maxInstances
  );
}

export function createVertices(
  gridGeometry: IGridGeometry,
  needsRedraw: RedrawFlag,
  createFeatureObject: (maxInstances: number) => IInstancedFeatureObject<IGridVertex, IFeature<IGridVertex>>,
  maxInstances?: number | undefined
) {
  return new InstancedFeatures<IGridVertex, IFeature<IGridVertex>>(
    gridGeometry, needsRedraw, vertexString, createFeatureObject, maxInstances
  );
}

export type Vertices = InstancedFeatures<IGridVertex, IFeature<IGridVertex>>;