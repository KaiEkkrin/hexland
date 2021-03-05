import { createContext, useEffect, useState } from 'react';
import * as React from 'react';

import firebase from 'firebase/app';
import 'firebase/analytics';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/functions';
import 'firebase/storage';

import { IContextProviderProps, IFirebaseContext, IFirebaseProps } from './interfaces';
import * as Auth from '../services/auth';

const region = 'europe-west2';

export const FirebaseContext = createContext<IFirebaseContext>({});

async function configureFirebase(setFirebaseContext: (c: IFirebaseContext) => void) {
  // Get app config and use it to create the Firebase app
  const response = await fetch('/__/firebase/init.json?v=2');
  const app = firebase.initializeApp(await response.json());
  const auth = app.auth();
  const db = app.firestore();
  const functions = app.functions(region);
  let storage: firebase.storage.Storage | undefined = undefined;
  let usingLocalEmulators = false;

  // Configure to use local emulators when running locally with webpack hot-plugging
  if ('webpackHotUpdate' in window) {
    const hostname = document.location.hostname;
    auth.useEmulator(`http://${hostname}:9099`);
    db.settings({
      host: `${hostname}:8080`,
      ssl: false
    });
    functions.useEmulator(hostname, 5001);
    usingLocalEmulators = true;
    console.log("Running with local emulators");
  } else {
    storage = app.storage();
  }

  setFirebaseContext({
    auth: new Auth.FirebaseAuth(auth),
    db: db,
    functions: functions,
    googleAuthProvider: Auth.googleAuthProviderWrapper,
    storage: storage,
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp,
    usingLocalEmulators: usingLocalEmulators,
    createAnalytics: () => app.analytics()
  });
}

// This provides the Firebase context, and should be replaced to unit test with the
// Firebase simulator.
function FirebaseContextProvider(props: IContextProviderProps & IFirebaseProps) {
  const [firebaseContext, setFirebaseContext] = useState<IFirebaseContext>({});

  // On load, fetch our Firebase config and initialize
  useEffect(() => {
    configureFirebase(setFirebaseContext)
      .catch(e => console.error("Error configuring Firebase", e));
  }, []);

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
    </FirebaseContext.Provider>
  );
}

export default FirebaseContextProvider;