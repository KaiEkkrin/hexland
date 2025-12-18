import { createContext, useEffect, useState } from 'react';

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
  let config;
  const isLocalDevelopment = 'webpackHotUpdate' in window;

  // Try to get app config from Firebase Hosting
  try {
    const response = await fetch('/__/firebase/init.json?v=2');
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    config = await response.json();
  } catch (error) {
    // Fallback to local development config when not served via Firebase Hosting
    console.debug("Using local development Firebase config (emulator mode)", error);

    // Try to get project ID from admin credentials file
    let projectId = "hexland-test";
    try {
      const credsResponse = await fetch('/firebase-admin-credentials.json');
      if (credsResponse.ok) {
        const creds = await credsResponse.json();
        projectId = creds.project_id || projectId;
        console.debug(`Using project ID from credentials: ${projectId}`);
      }
    } catch (e) {
      console.debug("Could not load admin credentials, using default project ID", e);
    }

    config = {
      apiKey: "fake-api-key-for-emulator",
      authDomain: `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: "123456789",
      appId: "1:123456789:web:abcdef"
    };
  }

  const app = firebase.initializeApp(config);
  const auth = app.auth();
  const db = app.firestore();
  let storage: firebase.storage.Storage | undefined = undefined;
  let usingLocalEmulators = false;

  // Configure to use local emulators when running locally with webpack hot-plugging
  let functions: firebase.functions.Functions;
  if (isLocalDevelopment) {
    const hostname = document.location.hostname;
    auth.useEmulator(`http://${hostname}:9099`);
    db.settings({
      host: `${hostname}:8080`,
      ssl: false,
      merge: true
    });
    // In emulator mode, don't use region - the server exports functions without region
    // to avoid issues with test libraries (see functions/src/index.ts getFunctionBuilder)
    functions = app.functions();
    functions.useEmulator(hostname, 5001);
    usingLocalEmulators = true;
    console.debug("Running with local emulators");
  } else {
    functions = app.functions(region);
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
    // Don't initialize Analytics in local development mode (requires real API key)
    createAnalytics: isLocalDevelopment ? undefined : (() => app.analytics())
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