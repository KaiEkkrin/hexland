import { IGridCoord, IGridEdge } from "./coord";
import { IFeature, IToken } from "./feature";

export enum MapType {
  Hex = "hex",
  Square = "square",
}

export interface IMap {
  adventureId: string;
  adventureName: string;
  name: string;
  description: string;
  owner: string; // owning uid
  ty: MapType;

  areas: IFeature<IGridCoord>[];
  tokens: IToken[];
  walls: IFeature<IGridEdge>[];
}