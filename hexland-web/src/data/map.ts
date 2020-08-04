export enum MapType {
  Hex = "hex",
  Square = "square",
}

export interface IMap {
  adventureName: string;
  name: string;
  description: string;
  ty: MapType;
}