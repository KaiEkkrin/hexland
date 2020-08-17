import React, { useEffect, useState } from 'react';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { IContextProviderProps, IFirebaseContext, IUserContext } from './interfaces';

import { FirebaseAuth, GoogleAuthProviderWrapper } from '../services/auth';
import { DataService } from '../services/dataService';

export const FirebaseContext = React.createContext<IFirebaseContext>({
  auth: undefined,
  db: undefined,
  googleAuthProvider: undefined,
  timestampProvider: undefined
});

export const UserContext = React.createContext<IUserContext>({
  user: undefined,
  dataService: undefined
});

// This provides the Firebase and user contexts, and should be replaced to unit test with the
// Firebase simulator.
function FirebaseContextProvider(props: IContextProviderProps) {
  const [firebaseContext, setFirebaseContext] = useState<IFirebaseContext>({
    auth: undefined,
    db: undefined,
    googleAuthProvider: undefined,
    timestampProvider: undefined
  });

  // On load, fetch our Firebase config and initialize
  async function configureFirebase() {
    var response = await fetch('/__/firebase/init.json');
    var app = firebase.initializeApp(await response.json());
    setFirebaseContext({
      auth: new FirebaseAuth(app.auth()),
      db: app.firestore(),
      googleAuthProvider: new GoogleAuthProviderWrapper(),
      timestampProvider: firebase.firestore.FieldValue.serverTimestamp
    });
  }

  useEffect(() => {
    configureFirebase()
      .catch(e => console.error("Error configuring Firebase", e));
  }, []);

  const [userContext, setUserContext] = useState<IUserContext>({ user: undefined, dataService: undefined });

  // When we're connected to Firebase, subscribe to the auth state change event and create a
  // suitable user context
  useEffect(() => {
    return firebaseContext.auth?.onAuthStateChanged(u => {
      console.log("Creating user context from " + u?.uid);
      setUserContext({
        user: u,
        dataService: (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined || u === null || u === undefined) ?
          undefined : new DataService(firebaseContext.db, firebaseContext.timestampProvider, u.uid)
      });
    }, e => console.error("Authentication state error: ", e));
  }, [firebaseContext.auth, firebaseContext.db, firebaseContext.timestampProvider]);

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      <UserContext.Provider value={userContext}>
        {props.children}
      </UserContext.Provider>
    </FirebaseContext.Provider>
  );
}

export default FirebaseContextProvider;