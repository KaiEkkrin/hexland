import React, { useEffect, useState } from 'react';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { IContextProviderProps, IFirebaseContext } from './interfaces';
import { FirebaseAuth, GoogleAuthProviderWrapper } from '../services/auth';

export const FirebaseContext = React.createContext<IFirebaseContext>({
  auth: undefined,
  db: undefined,
  googleAuthProvider: undefined,
  timestampProvider: undefined
});

// This provides the Firebase context, and should be replaced to unit test with the
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

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
    </FirebaseContext.Provider>
  );
}

export default FirebaseContextProvider;