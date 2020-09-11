import { Subject } from 'rxjs';
import { IIdentified } from '../data/identified';
import { IDataService, IUser, IAuth, IAuthProvider, IAnalytics } from '../services/interfaces';

export interface IContextProviderProps {
  children: React.ReactNode;
}
 
export interface IFirebaseContext {
  auth: IAuth | undefined;
  db: firebase.firestore.Firestore | undefined;
  googleAuthProvider: IAuthProvider | undefined;
  // Return a numeric value in testing where the server timestamp isn't accessible
  timestampProvider: (() => firebase.firestore.FieldValue | number) | undefined;
  // Creates an Analytics provider
  createAnalytics: (() => IAnalytics) | undefined;
}

export interface IUserContext {
  user: IUser | null | undefined; // This is the field to query for "is a user logged in?"
                                  // undefined means "I don't know yet, wait"
                                  // null means "Not logged in"
  dataService: IDataService | undefined;
}

export interface IAnalyticsContext {
  analytics: IAnalytics | undefined;
  enabled: boolean; // Residing in local storage, this signals consent.
  setEnabled: (enabled: boolean) => void;
  logError: (message: string, e: any, fatal?: boolean | undefined) => void; // Use this error helper to track errors in GA where possible.
}

export interface IToast {
  title: string;
  message: string;
}

export interface IStatusContext {
  // The subject of toast additions (record set) or removals (record not set.)
  toasts: Subject<IIdentified<IToast | undefined>>;
}

export interface IFirebaseProps {
  // For testing only -- ignored by the real context provider.
  projectId?: string | undefined; // in testing, *must* be a unique identifier
  user?: IUser | null | undefined; // null for no user, undefined for default (the db owner)
}

export interface IRoutingProps {
  // For testing only -- ignored by the real routing.
  defaultRoute?: string | undefined;
}

export interface IAnalyticsProps {
  // These two optional functions can be set in testing to override the
  // use of local storage.
  getItem?: ((key: string) => string | null) | undefined;
  setItem?: ((key: string, value: string) => void) | undefined;
}