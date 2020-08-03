import { IGridCoord, CoordDictionary } from './coord';

// Describes an instanced feature:
// (Must be possible to copy this with Object.assign)
export interface IFeature<K> {
  position: K;
  colour: number;
}

// A token has some extra properties:
export interface IToken extends IFeature<IGridCoord> {
  text: string;
}

// This should be helpful
export class FeatureDictionary<K extends IGridCoord, F extends IFeature<K>> extends CoordDictionary<K, F> {
  addFeature(f: F): boolean {
    return this.add(f.position, f);
  }

  removeFeature(k: K): F | undefined {
    return this.remove(k);
  }
}