import { MapType } from './map';
import { IAdventureSummary } from "./profile";

export interface IAdventure {
  name: string;
  description: string;
  owner: string; // owning uid
  ownerName: string;
  maps: IMapSummary[];
}

export interface IMapSummary {
  adventureId: string;
  id: string;
  name: string;
  description: string;
  ty: MapType;
}

// TODO: In order to collection-group query this for all adventures shared with me,
// do I need to include the adventure id in these records?
// (`d.doc.ref.parent.id` should do it, no?)
export interface IPlayer {
  name: string;
}

export function summariseAdventure(id: string, a: IAdventure) {
  return {
    id: id,
    name: a.name,
    description: a.description,
    owner: a.owner
  } as IAdventureSummary;
}