export enum MapType {
  Hex = "hex",
  Square = "square",
}

export interface IMap {
  adventureName: string;
  name: string;
  description: string;
  owner: string; // to check whether we can consolidate
  ty: MapType;
}