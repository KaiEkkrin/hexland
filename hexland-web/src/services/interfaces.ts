import { IAdventure, IPlayer } from '../data/adventure';
import { IChange, IChanges } from '../data/change';
import { IIdentified } from '../data/identified';
import { IImages } from '../data/image';
import { IInvite } from '../data/invite';
import { IMap, MapType } from '../data/map';
import { IInviteExpiryPolicy } from '../data/policy';
import { IProfile } from '../data/profile';
import { ISprite, ISpritesheets } from '../data/sprite';
import { IConverter } from './converter';

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
  emailMd5: string | null; // MD5 hash of the email address
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
  isEqual(other: IDataReference<T>): boolean;
}

export interface IChildDataReference<T, U> extends IDataReference<T> {
  getParent(): IDataReference<U> | undefined;
}

// A reference to stored data, *and* the data fetched.
export interface IDataAndReference<T> extends IDataReference<T> {
  data: T;
}

// This service is for datastore-related operations.
export interface IDataService extends IDataView {
  // Adds incremental changes to a map.
  addChanges(adventureId: string, uid: string, mapId: string, changes: IChange[]): Promise<void>;

  // Gets all the maps in one adventure.
  getAdventureMapRefs(adventureId: string): Promise<IDataAndReference<IMap>[]>;

  // Gets an adventure.
  getAdventureRef(id: string): IDataReference<IAdventure>;

  // Gets a reference to a user's images record.
  getImagesRef(uid: string): IDataReference<IImages>;

  // Gets the current invite refs for an adventure.
  getInviteRef(adventureId: string, id: string): IDataReference<IInvite>;
  getLatestInviteRef(adventureId: string): Promise<IDataAndReference<IInvite> | undefined>;

  // Gets a map.
  getMapRef(adventureId: string, id: string): IChildDataReference<IMap, IAdventure>;
  getMapBaseChangeRef(adventureId: string, id: string, converter: IConverter<IChanges>): IDataReference<IChanges>;
  getMapIncrementalChangesRefs(adventureId: string, id: string, limit: number, converter: IConverter<IChanges>): Promise<IDataAndReference<IChanges>[] | undefined>;

  // Gets all my adventures, invites, and player records.
  getMyAdventures(uid: string): Promise<IDataAndReference<IAdventure>[]>;
  getMyPlayerRecords(uid: string): Promise<IDataAndReference<IPlayer>[]>;

  // Gets a reference to a player record for an adventure.
  getPlayerRef(adventureId: string, uid: string): IDataReference<IPlayer>;

  // Gets refs to all players currently in an adventure.
  getPlayerRefs(adventureId: string): Promise<IDataAndReference<IPlayer>[]>;

  // Gets the user's profile.
  getProfileRef(uid: string): IDataReference<IProfile>;

  // Gets a reference to the sprites record for an adventure.
  getSpritesRef(adventureId: string): IDataReference<ISpritesheets>;

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

export interface IDownloadUrlCache {
  // This is a handy way to smuggle error logging into the webgl stuff
  logError(message: string, e: any): void;

  // Looks up a path to a URL asynchronously.
  resolve(path: string): Promise<string>;

  // Releases the resources associated with the URL we previously looked up.
  release(url: string): void;
}

// Provides access to Firebase Functions.
export interface IFunctionsService {
  // Creates a new adventure, returning its ID.
  createAdventure(name: string, description: string): Promise<string>;

  // Creates a new map, returning its ID.
  createMap(adventureId: string, name: string, description: string, ty: MapType, ffa: boolean): Promise<string>;

  // Clones a map in the same adventure, returning the new map ID.
  cloneMap(adventureId: string, mapId: string, name: string, description: string): Promise<string>;

  // Consolidates changes in the given map.
  consolidateMapChanges(adventureId: string, mapId: string, resync: boolean): Promise<void>;

  // Deletes an image.
  deleteImage(path: string): Promise<void>;

  // Adds a new image to a sprite or replaces an existing one.
  editSprite(adventureId: string, newPath: string, oldPath?: string | undefined): Promise<ISprite>;

  // For mock storage use only -- not production.
  handleMockStorageUpload(imageId: string, name: string): Promise<void>;

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

// A stripped-down abstraction around Firebase Storage that lets me use a mock one in local
// testing (standing in for an emulator.)
export interface IStorage {
  // Gets a reference to this path.
  ref(path: string): IStorageReference;
}

export interface IStorageReference {
  // Deletes the object.
  delete(): Promise<void>;

  // Downloads the object from storage.
  download(destination: string): Promise<void>;

  // Gets the download URL for this object.
  getDownloadURL(): Promise<string>;

  // Uploads a file here.
  put(file: Blob | Buffer, metadata: any): Promise<void>;

  // Uploads a file here (from the filesystem.)
  upload(source: string, metadata: { contentType: string }): Promise<void>;
}

export interface IWebDAV {
  // For the streams, I'm going to supply the absolute minimal interface to get working...
  createReadStream(path: string): any;
  createWriteStream(path: string, options: any): any; 
  deleteFile(path: string): Promise<void>;
  getFileDownloadLink(path: string): string;
  putFileContents(path: string, file: Blob | Buffer): Promise<void>;
}
