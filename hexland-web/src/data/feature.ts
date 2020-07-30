import { IGridCoord } from './coord';

// Describes an instanced feature:
export interface IFeature<K> {
  position: K;
  colour: number;
}

// A token has some extra properties:
export interface IToken extends IFeature<IGridCoord> {
  text: string;
}