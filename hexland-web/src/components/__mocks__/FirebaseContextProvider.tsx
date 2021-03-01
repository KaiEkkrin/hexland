import { createContext, useState, useEffect } from 'react';

import firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { initializeTestApp } from '@firebase/rules-unit-testing';

import { IContextProviderProps, IFirebaseContext, IFirebaseProps } from '../interfaces';
import { IAuth, IUser, IAuthProvider } from '../../services/interfaces';

import { v4 as uuidv4 } from 'uuid';

// To successfully call Firebase Functions we *must* use a fixed project ID, which
// is pretty annoying
const projectId = 'hexland-test';
const region = 'europe-west2';

export const FirebaseContext = createContext<IFirebaseContext>({});

// This module provides a Firebase context provider that uses the simulator.
// To do this, we need to track project IDs (different for every test and database)
// and clean them up afterwards:
const emulsToDelete: firebase.app.App[] = [];

afterAll(async () => {
  while (true) {
    let emul = emulsToDelete.pop();
    if (emul === undefined) {
      break;
    }
    await emul.delete();
  }
});

function FirebaseContextProvider(props: IContextProviderProps & IFirebaseProps) {
  const [firebaseContext, setFirebaseContext] = useState<IFirebaseContext>({});
  useEffect(() => {
    const emul = initializeTestApp({
      projectId: projectId,
      auth: props.user ?? undefined
    });

    simulatedAuth.setUser(props.user ?? null);
    const functions = emul.functions(region);
    functions.useFunctionsEmulator('http://localhost:5001');
    setFirebaseContext({
      auth: simulatedAuth,
      db: emul.firestore(),
      functions: functions,
      googleAuthProvider: {},
      timestampProvider: jest.fn(),
      usingLocalEmulators: true,
      createAnalytics: undefined
    });

    return () => { emulsToDelete.push(emul); };
  }, [props.user]);

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
    </FirebaseContext.Provider>
  );
}

// Simulates the authentication subsystem, which the Firebase emulator doesn't provide.
type UserHandler = (user: IUser | null) => void;
class SimulatedAuth implements IAuth {
  private _user: IUser | null;
  private readonly _userHandlers = new Map<string, UserHandler>();
  private _isLoggedIn = false;

  constructor(user: IUser | null) {
    this._user = user;
  }

  private signInSync() {
    if (this._isLoggedIn !== true) {
      this._isLoggedIn = true;
      this._userHandlers.forEach(h => h(this._user));
    }
    return Promise.resolve(this._user);
  }

  private signOutSync() {
    if (this._isLoggedIn !== false) {
      this._isLoggedIn = false;
      this._userHandlers.forEach(h => h(null));
    }
  }

  createUserWithEmailAndPassword(email: string, password: string, displayName: string) {
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
    this._userHandlers.set(id, onNext);
    return () => {
      this._userHandlers.delete(id);
    }
  }
}

// We maintain a global simulation of the authentication state:
const simulatedAuth = new SimulatedAuth(null);

export default FirebaseContextProvider;