import React, { useEffect, useState, useContext } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { IContextProviderProps, ISignInMethodsContext, IUserContext } from './interfaces';

import { DataService } from '../services/dataService';
import { FunctionsService } from '../services/functions';
import { MockStorage } from '../services/mockStorage';
import { Storage } from '../services/storage';

export const UserContext = React.createContext<IUserContext>({
  user: undefined,
});

export const SignInMethodsContext = React.createContext<ISignInMethodsContext>({
  signInMethods: []
});

// This provides the user context.
function UserContextProvider(props: IContextProviderProps) {
  const firebaseContext = useContext(FirebaseContext);
  const [userContext, setUserContext] = useState<IUserContext>({ user: undefined });

  // When we're connected to Firebase, subscribe to the auth state change event and create a
  // suitable user context
  useEffect(() => {
    const functionsService = firebaseContext.functions === undefined ? undefined :
      new FunctionsService(firebaseContext.functions);

    const realStorageService = firebaseContext.storage === undefined ? undefined :
      new Storage(firebaseContext.storage);

    return firebaseContext.auth?.onAuthStateChanged(u => {
      // Create the relevant storage service (if any.)  If webpack hot-plugging is enabled,
      // we use the mock storage service because there isn't an emulator
      const storageService = functionsService === undefined || !u ? undefined :
        ('webpackHotUpdate' in window) ? new MockStorage(functionsService, u.uid) :
        realStorageService;

      setUserContext({
        user: u,
        dataService: (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined || u === null || u === undefined) ?
          undefined : new DataService(firebaseContext.db, firebaseContext.timestampProvider),
        functionsService: functionsService,
        storageService: storageService
      });
    }, e => console.error("Authentication state error: ", e));
  }, [firebaseContext]);

  // Check newly logged in users for sign-in methods (e.g. governs whether we can reset passwords)
  const [signInMethodsContext, setSignInMethodsContext] = useState<ISignInMethodsContext>({ signInMethods: [] });

  useEffect(() => {
    const email = userContext.user?.email;
    if (email !== undefined && email !== null) {
      firebaseContext.auth?.fetchSignInMethodsForEmail(email)
        .then(m => setSignInMethodsContext({ signInMethods: m }))
        .catch(e => console.error("Unable to fetch sign-in methods for " + email, e));
    } else {
      setSignInMethodsContext({ signInMethods: [] });
    }
  }, [firebaseContext.auth, userContext, setSignInMethodsContext]);

  return (
    <UserContext.Provider value={userContext}>
      <SignInMethodsContext.Provider value={signInMethodsContext}>
        {props.children}
      </SignInMethodsContext.Provider>
    </UserContext.Provider>
  );
}

export default UserContextProvider;