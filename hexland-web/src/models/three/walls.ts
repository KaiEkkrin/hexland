import { IGridEdge, edgeString } from '../../data/coord';
import { IFeature, IFeatureDictionary } from '../../data/feature';
import { IGridGeometry } from "../gridGeometry";
import { InstancedFeatures } from './instancedFeatures';
import { PaletteColouredFeatureObject, IColourParameters } from './paletteColouredFeatureObject';
import { RedrawFlag } from '../redrawFlag';

import * as THREE from 'three';

export function createPaletteColouredWallObject(gridGeometry: IGridGeometry, alpha: number, wallZ: number, colourParameters: IColourParameters) {
  const single = gridGeometry.toSingle();
  const vertices = [...single.createWallVertices(alpha, wallZ)];
  return (maxInstances: number) => new PaletteColouredFeatureObject(
    edgeString,
    (o, p) => gridGeometry.transformToEdge(o, p),
    maxInstances,
    () => {
      const geometry = new THREE.InstancedBufferGeometry();
      geometry.setFromPoints(vertices);
      return geometry;
    },
    colourParameters
  );
}

// The "walls" are the edges of the map that are coloured in one of our
// known colours.  To implement line-of-sight, we synchronise this object with
// the LoS features object.
export class Walls extends InstancedFeatures<IGridEdge, IFeature<IGridEdge>, PaletteColouredFeatureObject<IGridEdge, IFeature<IGridEdge>>> {
  private readonly _losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined;

  constructor(
    gridGeometry: IGridGeometry,
    redrawFlag: RedrawFlag,
    losFeatures: IFeatureDictionary<IGridEdge, IFeature<IGridEdge>> | undefined,
    alpha: number,
    wallZ: number,
    colourParameters: IColourParameters,
    maxInstances?: number | undefined
  ) {
    super(
      gridGeometry,
      redrawFlag,
      edgeString,
      createPaletteColouredWallObject(gridGeometry, alpha, wallZ, colourParameters),
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
    var feature = super.remove(oldPosition);
    if (feature !== undefined) {
      this._losFeatures?.remove(oldPosition);
    }

    return feature;
  }
}