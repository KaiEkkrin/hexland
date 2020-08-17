import React, { useEffect, useState, useContext } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { IContextProviderProps, IUserContext } from './interfaces';

import { DataService } from '../services/dataService';

export const UserContext = React.createContext<IUserContext>({
  user: undefined,
  dataService: undefined
});

// This provides the user context.
function UserContextProvider(props: IContextProviderProps) {
  const firebaseContext = useContext(FirebaseContext);
  const [userContext, setUserContext] = useState<IUserContext>({ user: undefined, dataService: undefined });

  // When we're connected to Firebase, subscribe to the auth state change event and create a
  // suitable user context
  useEffect(() => {
    return firebaseContext.auth?.onAuthStateChanged(u => {
      //console.log("Creating user context from " + u?.uid);
      setUserContext({
        user: u,
        dataService: (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined || u === null || u === undefined) ?
          undefined : new DataService(firebaseContext.db, firebaseContext.timestampProvider, u.uid)
      });
    }, e => console.error("Authentication state error: ", e));
  }, [firebaseContext.auth, firebaseContext.db, firebaseContext.timestampProvider]);

  return (
    <UserContext.Provider value={userContext}>
      {props.children}
    </UserContext.Provider>
  );
}

export default UserContextProvider;