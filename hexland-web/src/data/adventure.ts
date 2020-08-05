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

// To support a collection group query for all adventures shared with me (and get
// the summaries right away), each Player record shall contain the summary of the
// adventure the player has joined.  (Changes will be infrequent, compared to queries
// for the "Shared with me" page.)
export interface IPlayer extends IAdventureSummary {
  playerId: string; // the uid -- also the record id
  playerName: string;
}

export function summariseAdventure(id: string, a: IAdventure) {
  return {
    id: id,
    name: a.name,
    description: a.description,
    owner: a.owner,
    ownerName: a.ownerName
  } as IAdventureSummary;
}