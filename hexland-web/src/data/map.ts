export enum MapType {
  Hex = "hex",
  Square = "square",
}

export interface IMap {
  name: string,
  ty: MapType,

  // TODO Add the map content here, or in sub-collections...?
}