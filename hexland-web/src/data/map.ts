export enum MapType {
  Hex = "hex",
  Square = "square",
}

export interface IMap {
  name: string;
  description: string;
  owner: string; // owning uid
  ty: MapType;
}