import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IInvite } from '../data/invite';
import { IMap } from '../data/map';
import { IInviteExpiryPolicy } from '../data/policy';
import { IProfile } from '../data/profile';

// Abstracts the Firebase authentication stuff, which isn't supported by the
// simulator.
export interface IAuth {
  createUserWithEmailAndPassword(email: string, password: string): Promise<IUser | null>;
  fetchSignInMethodsForEmail(email: string): Promise<Array<string>>;
  sendPasswordResetEmail(email: string): Promise<void>;
  signInWithEmailAndPassword(email: string, password: string): Promise<IUser | null>;
  signInWithPopup(provider: IAuthProvider | undefined): Promise<IUser | null>;
  signOut(): Promise<void>;

  onAuthStateChanged(
    onNext: (user: IUser | null) => void,
    onError?: ((e: Error) => void) | undefined
  ): () => void;
}

export type IAuthProvider = {};

// A user.  (Exposes the things we want from `firebase.User` -- may need extending;
// but needs to be hidden behind this interface to facilitate unit testing.)
export interface IUser {
  displayName: string | null;
  email: string | null;
  emailVerified: boolean;
  providerId: string;
  uid: string;

  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  sendEmailVerification: () => Promise<void>;
  updateProfile: (p: any) => Promise<void>;
}

// The analytics service.
export interface IAnalytics {
  logEvent(event: string, parameters: any): void;
}

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
  addChanges(adventureId: string, uid: string, mapId: string, changes: IChange[]): Promise<void>;

  // Gets an adventure.
  getAdventureRef(id: string): IDataReference<IAdventure>;

  // Gets the current invite refs for an adventure.
  getInviteRef(adventureId: string, id: string): IDataReference<IInvite>;
  getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined>;

  // Gets a map.
  getMapRef(adventureId: string, id: string): IDataReference<IMap>;
  getMapBaseChangeRef(adventureId: string, id: string): IDataReference<IChanges>;
  getMapIncrementalChangesRefs(adventureId: string, id: string, limit: number): Promise<IDataAndReference<IChanges>[] | undefined>;

  // Gets all my adventures, invites, and player records.
  getMyAdventures(uid: string): Promise<IDataAndReference<IAdventure>[]>;
  getMyPlayerRecords(uid: string): Promise<IDataAndReference<IPlayer>[]>;

  // Gets a reference to a player record for an adventure.
  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer>;

  // Gets refs to all players currently in an adventure.
  getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]>;

  // Gets the user's profile.
  getProfileRef(uid: string): IDataReference<IProfile>;

  // Runs a transaction. The `dataView` parameter accepted by the
  // transaction function does things in the transaction's context.
  runTransaction<T>(fn: (dataView: IDataView) => Promise<T>): Promise<T>;

  // Watches a single object.  Call the returned function to stop.
  watch<T>(
    d: IDataReference<T>,
    onNext: (r: T | undefined) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches all the user's adventures.  Call the returned function to stop.
  watchAdventures(
    uid: string,
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

  // Watches the players in a particular adventure.
  watchPlayers(
    adventureId: string,
    onNext: (players: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;

  // Watches all adventures shared with this user.
  watchSharedAdventures(
    uid: string,
    onNext: (adventures: IPlayer[]) => void,
    onError?: ((error: Error) => void) | undefined,
    onCompletion?: (() => void) | undefined
  ): () => void;
}

// A view of data, either the generalised data service or a transaction.
export interface IDataView {
  delete<T>(r: IDataReference<T>): Promise<void>;
  get<T>(r: IDataReference<T>): Promise<T | undefined>;
  set<T>(r: IDataReference<T>, value: T): Promise<void>; // call this with an explicit type so TypeScript
                                                         // can check you included all the right fields
  update<T>(r: IDataReference<T>, changes: any): Promise<void>;
}

// Provides access to Firebase Functions.
export interface IFunctionsService {
  // Creates a new adventure, returning its ID.
  createAdventure(name: string, description: string): Promise<string>;

  // Consolidates changes in the given map.
  consolidateMapChanges(adventureId: string, mapId: string, resync: boolean): Promise<void>;

  // Creates and returns an adventure invite.
  inviteToAdventure(adventureId: string, policy?: IInviteExpiryPolicy | undefined): Promise<string>;

  // Joins an adventure.
  joinAdventure(adventureId: string, inviteId: string, policy?: IInviteExpiryPolicy | undefined): Promise<void>;
}

// Provides logging for the extensions.
export interface ILogger {
  logError(message: string, ...optionalParams: any[]): void;
  logInfo(message: string, ...optionalParams: any[]): void;
  logWarning(message: string, ...optionalParams: any[]): void;
}