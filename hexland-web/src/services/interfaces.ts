import { IAdventure } from '../data/adventure';
import { IIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// A reference to stored data.
export interface IDataReference<T> {
  convert(rawData: any): T;
}

// This service is for datastore-related operations.
export interface IDataService extends IDataView {
  // Gets an adventure.
  getAdventure(id: string): Promise<IAdventure | undefined>;
  getAdventureRef(id: string): IDataReference<IAdventure>;

  // Gets a map.
  getMap(id: string): Promise<IMap | undefined>;
  getMapRef(id: string): IDataReference<IMap>;

  // Gets the user's profile.
  getProfile(): Promise<IProfile | undefined>;
  getProfileRef(): IDataReference<IProfile>;

  // Gets the current user id.
  getUid(): string;

  // Runs a transaction. The `dataView` parameter accepted by the
  // transaction function does things in the transaction's context.
  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T>;

  // Creates or edits an adventure.
  setAdventure(id: string, adventure: IAdventure): Promise<void>;

  // Creates or edits a map.
  setMap(id: string, map: IMap): Promise<void>;

  // Creates or edits the user's profile.
  setProfile(profile: IProfile): Promise<void>;

  // Watches a particular adventure.  Call the returned function to stop.
  watchAdventure(
    id: string,
    onNext: (adventure: IAdventure) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches all the user's adventures.  Call the returned function to stop.
  watchAdventures(
    onNext: (adventures: IIdentified<IAdventure>[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches the user's profile.
  watchProfile(
    onNext: (profile: IProfile) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;
}

// A view of data, either the generalised data service or a transaction.
export interface IDataView {
  delete<T>(r: IDataReference<T>): Promise<void>;
  get<T>(r: IDataReference<T>): Promise<T | undefined>;
  set<T>(r: IDataReference<T>, value: T): Promise<void>;
  update<T>(r: IDataReference<T>, changes: any): Promise<void>;
}