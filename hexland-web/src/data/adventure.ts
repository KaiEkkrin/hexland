import { IIdentified } from './identified';
import { IAdventureSummary } from "./profile";

export interface IAdventure {
  name: string;
  description: string;
  owner: string; // owning uid
  maps: IMapSummary[];
}

export interface IMapSummary {
  id: string;
  name: string;
  description: string;
}

export class SummaryOfAdventure implements IAdventureSummary {
  private _id: string;
  private _a: IAdventure;

  constructor(id: string, a: IAdventure) {
    this._id = id;
    this._a = a;
  }

  get id(): string { return this._id; }
  set id(value: string) { this._id = value; }

  get name(): string { return this._a.name; }
  set name(value: string) { this._a.name = value; }

  get description(): string { return this._a.description; }
  set description(value: string) { this._a.description = value; }

  get owner(): string { return this._a.owner; }
  set owner(value: string) { this._a.owner = value; }
}