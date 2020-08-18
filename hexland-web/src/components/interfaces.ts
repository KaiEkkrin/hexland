import { IDataService, IUser, IAuth, IAuthProvider } from '../services/interfaces';

export interface IContextProviderProps {
  children: React.ReactNode;
}
 
export interface IFirebaseContext {
  auth: IAuth | undefined;
  db: firebase.firestore.Firestore | undefined;
  googleAuthProvider: IAuthProvider | undefined;
  // Return a numeric value in testing where the server timestamp isn't accessible
  timestampProvider: (() => firebase.firestore.FieldValue | number) | undefined;
}

export interface IUserContext {
  user: IUser | null | undefined; // This is the field to query for "is a user logged in?"
                                  // undefined means "I don't know yet, wait"
                                  // null means "Not logged in"
  dataService: IDataService | undefined;
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