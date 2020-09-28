import { IMapSummary } from "./adventure";

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
  ffa: boolean;
}

export function summariseMap(adventureId: string, mapId: string, m: IMap): IMapSummary {
  return {
    adventureId: adventureId,
    id: mapId,
    name: m.name,
    description: m.description,
    ty: m.ty
  };
}