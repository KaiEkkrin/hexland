import { IDataService, IUser, IAuth, IAuthProvider } from '../services/interfaces';

export interface IContextProviderProps {
  children: React.ReactNode;
}
 
export interface IFirebaseContext {
  auth: IAuth | undefined;
  db: firebase.firestore.Firestore | undefined;
  googleAuthProvider: IAuthProvider | undefined;
  timestampProvider: (() => firebase.firestore.FieldValue) | undefined;
}

export interface IUserContext {
  user: IUser | null | undefined; // This is the field to query for "is a user logged in?"
                                  // undefined means "I don't know yet, wait"
                                  // null means "Not logged in"
  dataService: IDataService | undefined;
}
