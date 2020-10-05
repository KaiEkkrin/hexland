import { IGridVertex, vertexString } from '../../data/coord';
import { IFeature } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { IInstancedFeatureObject } from './instancedFeatureObject';
import { InstancedFeatures } from './instancedFeatures';
import { MultipleFeatureObject } from './multipleFeatureObject';
import { PaletteColouredFeatureObject, IColourParameters, createSelectionColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export function createTokenFillVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  const vertices = [...gridGeometry.createTokenFillVertexVertices(alpha, z)];
  const indices = gridGeometry.createTokenFillVertexIndices();
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

export function createVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number, maxVertex?: number | undefined) {
  const vertices = [...gridGeometry.createSolidVertexVertices(new THREE.Vector2(0, 0), alpha, z, maxVertex)];
  const indices = [...gridGeometry.createSolidVertexIndices()];
  return () => {
    const geometry = new THREE.InstancedBufferGeometry();
    geometry.setFromPoints(vertices);
    geometry.setIndex(indices);
    return geometry;
  };
}

export function createSingleVertexGeometry(gridGeometry: IGridGeometry, alpha: number, z: number) {
  return createVertexGeometry(gridGeometry.toSingle(), alpha, z, 1);
}

export function createPaletteColouredVertexObject(createGeometry: () => THREE.InstancedBufferGeometry, gridGeometry: IGridGeometry, colourParameters: IColourParameters) {
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    vertexString,
    (o, p) => gridGeometry.transformToVertex(o, p),
    maxInstances,
    createGeometry,
    colourParameters
  );
}

export function createSelectionColouredVertexObject(createGeometry: () => THREE.InstancedBufferGeometry, gridGeometry: IGridGeometry) {
  return (maxInstances: number) => new MultipleFeatureObject<IGridVertex, IFeature<IGridVertex>>(
    (i: number, maxInstances: number) => new PaletteColouredFeatureObject(
      vertexString,
      (o, p) => gridGeometry.transformToVertex(o, p),
      maxInstances,
      createGeometry,
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