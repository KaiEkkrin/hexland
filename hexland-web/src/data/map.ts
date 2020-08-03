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
}