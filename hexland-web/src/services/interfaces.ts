import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IInvite } from '../data/invite';
import { IMap } from '../data/map';
import { IProfile } from '../data/profile';

// A reference to stored data.
export interface IDataReference<T> {
  id: string;
  convert(rawData: any): T;
}

// A reference to stored data, *and* the data fetched.
export interface IDataAndReference<T> extends IDataReference<T> {
  data: T;
}

// This service is for datastore-related operations.
export interface IDataService extends IDataView {
  // Adds incremental changes to a map.
  addChanges(adventureId: string, mapId: string, changes: IChange[]): Promise<void>;

  // Gets an adventure.
  getAdventureRef(id: string): IDataReference<IAdventure>;

  // Gets the current invite refs for an adventure.
  getInviteRef(adventureId: string, id: string): IDataReference<IInvite>;
  getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined>;

  // Gets a map.
  getMap(adventureId: string, id: string): Promise<IMap | undefined>;
  getMapRef(adventureId: string, id: string): IDataReference<IMap>;

  getMapBaseChangeRef(adventureId: string, id: string): IDataReference<IChanges>;
  getMapChangesRefs(adventureId: string, id: string): Promise<IDataAndReference<IChanges>[] | undefined>;

  // Gets a reference to a player record for an adventure.
  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer>;

  // Gets refs to all players currently in an adventure.
  getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]>;

  // Gets the user's profile.
  getProfileRef(): IDataReference<IProfile>;

  // Gets the current user id.
  getUid(): string;

  // Runs a transaction. The `dataView` parameter accepted by the
  // transaction function does things in the transaction's context.
  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T>;

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

  // Watches changes to a map.
  watchChanges(
    adventureId: string,
    mapId: string,
    onNext: (changes: IChanges) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches the user's profile.
  watchProfile(
    onNext: (profile: IProfile | undefined) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches all adventures shared with this user.
  watchSharedAdventures(
    onNext: (adventures: IPlayer[]) => void,
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