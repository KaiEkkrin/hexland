import { IMapSummary } from './adventure';

export interface IProfile {
  name: string; // a friendly user name to have in maps
  adventures: IAdventureSummary[] | undefined; 
  latestMaps: IMapSummary[] | undefined;
}

export interface IAdventureSummary {
  id: string;
  name: string;
  description: string;
  owner: string; // owning uid
  ownerName: string;
}