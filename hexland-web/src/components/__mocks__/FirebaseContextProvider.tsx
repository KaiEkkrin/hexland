import React, { useState, useEffect } from 'react';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { clearFirestoreData, initializeTestApp } from '@firebase/rules-unit-testing';

import { IContextProviderProps, IFirebaseContext, IFirebaseProps } from '../interfaces';
import { IAuth, IUser, IAuthProvider } from '../../services/interfaces';

import { v4 as uuidv4 } from 'uuid';

const region = 'europe-west2';

export const FirebaseContext = React.createContext<IFirebaseContext>({});

// This module provides a Firebase context provider that uses the simulator.
// To do this, we need to track project IDs (different for every test and database)
// and clean them up afterwards:
const emulsToDelete: firebase.app.App[] = [];
const idsToClear: { [id: string]: boolean } = {};

// The Firebase emulator doesn't appear to provide server timestamps, so instead
// we increment this global:
let timestamp = 0;

afterEach(async () => {
  while (true) {
    let emul = emulsToDelete.pop();
    if (emul === undefined) {
      break;
    }
    await emul.delete();
  }
});

afterAll(async () => {
  for (let id in idsToClear) {
    await clearFirestoreData({ projectId: id });
  }
});

function FirebaseContextProvider(props: IContextProviderProps & IFirebaseProps) {
  const [firebaseContext, setFirebaseContext] = useState<IFirebaseContext>({});
  useEffect(() => {
    if (props.projectId === undefined) {
      throw RangeError("Project id must be defined in testing");
    }

    const emul = initializeTestApp({
      projectId: props.projectId,
      auth: props.user ?? undefined
    });

    simulatedAuth.setUser(props.user ?? null);
    setFirebaseContext({
      auth: simulatedAuth,
      db: emul.firestore(),
      functions: emul.functions(region),
      googleAuthProvider: {},
      timestampProvider: () => timestamp++,
      createAnalytics: undefined
    });

    return () => { emulsToDelete.push(emul); };
  }, [props.projectId, props.user]);

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
    </FirebaseContext.Provider>
  );
}

// Simulates the authentication subsystem, which the Firebase emulator doesn't provide.
class SimulatedAuth implements IAuth {
  private _user: IUser | null;
  private readonly _userHandlers: { [id: string]: ((user: IUser | null) => void) } = {};
  private _isLoggedIn = false;

  constructor(user: IUser | null) {
    this._user = user;
  }

  private signInSync() {
    if (this._isLoggedIn !== true) {
      this._isLoggedIn = true;
      for (let id in this._userHandlers) {
        this._userHandlers[id](this._user);
      }
    }
    return Promise.resolve(this._user);
  }

  private signOutSync() {
    if (this._isLoggedIn !== false) {
      this._isLoggedIn = false;
      for (let id in this._userHandlers) {
        this._userHandlers[id](null);
      }
    }
  }

  createUserWithEmailAndPassword(email: string, password: string) {
    return this.signInSync();
  }

  fetchSignInMethodsForEmail(email: string) {
    // TODO Fill this in if I find myself needing it
    return Promise.resolve([]);
  }

  sendPasswordResetEmail(email: string) {
    return Promise.resolve();
  }

  signInWithEmailAndPassword(email: string, password: string): Promise<IUser | null> {
    return this.signInSync();
  }

  setUser(user: IUser | null) {
    if (user?.uid !== this._user?.uid) {
      // We change the expected uid, and sign out of the previous user
      // if we were signed in:
      this.signOutSync();
      this._user = user;
    }
  }

  signInWithPopup(provider: IAuthProvider | undefined) {
    return this.signInSync();
  }

  signOut() {
    this.signOutSync();
    return Promise.resolve();
  }

  onAuthStateChanged(onNext: (user: IUser | null) => void, onError?: ((e: Error) => void) | undefined) {
    onNext(this._isLoggedIn ? this._user : null);

    let id = uuidv4();
    this._userHandlers[id] = onNext;
    return () => {
      delete this._userHandlers[id];
    }
  }
}

// We maintain a global simulation of the authentication state:
const simulatedAuth = new SimulatedAuth(null);

export default FirebaseContextProvider;