import React, { useEffect, useState } from 'react';

import * as firebase from 'firebase/app';
import 'firebase/analytics';
import 'firebase/auth';
import 'firebase/firestore';
import 'firebase/functions';

import { IContextProviderProps, IFirebaseContext, IFirebaseProps } from './interfaces';
import * as Auth from '../services/auth';

const region = 'europe-west2';

export const FirebaseContext = React.createContext<IFirebaseContext>({});

async function configureFirebase(setFirebaseContext: (c: IFirebaseContext) => void) {
  let response = await fetch('/__/firebase/init.json');
  let app = firebase.initializeApp(await response.json());
  setFirebaseContext({
    auth: new Auth.FirebaseAuth(app.auth()),
    db: app.firestore(),
    functions: app.functions(region),
    googleAuthProvider: Auth.googleAuthProviderWrapper,
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp,
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