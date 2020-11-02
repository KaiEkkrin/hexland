import { IAdventure, IPlayer } from '../data/adventure';
import { IAdventureIdentified, IIdentified } from '../data/identified';
import { IMap } from '../data/map';
import { IMapState, MapStateMachine } from '../models/mapStateMachine';
import { IDataService, IUser, IAuth, IAuthProvider, IAnalytics, IFunctionsService, IStorage, ISpriteManager } from '../services/interfaces';

import firebase from 'firebase/app';
import { Subject } from 'rxjs';

export interface IContextProviderProps {
  children?: React.ReactNode;
}
 
export interface IFirebaseContext {
  auth?: IAuth | undefined;
  db?: firebase.firestore.Firestore | undefined;
  functions?: firebase.functions.Functions | undefined;
  googleAuthProvider?: IAuthProvider | undefined;
  storage?: firebase.storage.Storage | undefined;
  timestampProvider?: (() => firebase.firestore.FieldValue) | undefined;
  usingLocalEmulators?: boolean | undefined;
  // Creates an Analytics provider
  createAnalytics?: (() => IAnalytics) | undefined;
}

export interface IUserContext {
  user: IUser | null | undefined; // This is the field to query for "is a user logged in?"
                                  // undefined means "I don't know yet, wait"
                                  // null means "Not logged in"
  dataService?: IDataService | undefined;
  functionsService?: IFunctionsService | undefined;
  storageService?: IStorage | undefined;
}

export interface ISignInMethodsContext {
  signInMethods: string[];
}

export interface IAnalyticsContext {
  analytics: IAnalytics | undefined;
  enabled: boolean | undefined; // Residing in local storage, this signals consent.
  setEnabled: (enabled: boolean | undefined) => void;
  logError: (message: string, e: any, fatal?: boolean | undefined) => void; // Use this error helper to track errors in GA where possible.
  logEvent: (event: string, parameters: any) => void;
}

export interface IToast {
  title: string;
  message: string;
}

export interface IStatusContext {
  // The subject of toast additions (record set) or removals (record not set.)
  toasts: Subject<IIdentified<IToast | undefined>>;
}

export interface IAdventureContext {
  adventure?: IIdentified<IAdventure> | undefined;
  players: IPlayer[];
  spriteManager?: ISpriteManager | undefined;
}

export interface IMapContext {
  map?: IAdventureIdentified<IMap> | undefined;
  mapState: IMapState;
  stateMachine?: MapStateMachine | undefined;
}

export interface IFirebaseProps {
  // For testing only -- ignored by the real context provider.
  user?: IUser | null; // null for no user
}

export interface IRoutingProps {
  // For testing only -- ignored by the real routing.
  defaultRoute?: string | undefined;
}

export interface IAnalyticsProps {
  // These two optional functions can be set in testing to override the
  // use of local storage.
  getItem?: ((key: string) => string | null) | undefined;
  setItem?: ((key: string, value: string | null) => void) | undefined;
}