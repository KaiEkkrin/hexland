import React from 'react';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { clearFirestoreData, initializeTestApp } from '@firebase/testing';

import { IContextProviderProps, IFirebaseContext, IFirebaseProps } from '../interfaces';
import { IAuth, IUser, IAuthProvider } from '../../services/interfaces';

import { v4 as uuidv4 } from 'uuid';

export const FirebaseContext = React.createContext<IFirebaseContext>({
  auth: undefined,
  db: undefined,
  googleAuthProvider: undefined,
  timestampProvider: undefined
});

// This module provides a Firebase context provider that uses the simulator.
// To do this, we need to track project IDs (different for every test and database)
// and clean them up afterwards:
const idsToClear: string[] = [];
var emul: { [id: string]: firebase.app.App } = {};
var auths: { [id: string]: SimulatedAuth } = {};

afterEach(async () => {
  for (var id in emul) {
    await emul[id].delete();
    idsToClear.push(id);
  }
  emul = {};
  auths = {};
  //console.log("Cleaned up emuls");
});

afterAll(async () => {
  await Promise.all(idsToClear.map(id => clearFirestoreData({ projectId: id })));
  //console.log("Cleaned up " + idsToClear.length + " data");
});

function FirebaseContextProvider(props: IContextProviderProps & IFirebaseProps) {
  if (props.projectId === undefined) {
    throw RangeError("Project id must be defined in testing");
  }

  const user = props.user !== undefined ? props.user : {
    displayName: 'Owner',
    email: 'owner@example.com',
    uid: 'owner' // the magical does-everything uid.  TODO test with unprivileged users!
  }

  if (!(props.projectId in emul)) {
    emul[props.projectId] = initializeTestApp({
      projectId: props.projectId,
      auth: user ?? undefined
    });
    auths[props.projectId] = new SimulatedAuth(user);
  }

  const firebaseContext = {
    auth: auths[props.projectId],
    db: emul[props.projectId].firestore(),
    googleAuthProvider: {},
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp
  };

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
    </FirebaseContext.Provider>
  );
}

// Simulates the authentication subsystem, which the Firebase emulator doesn't provide.
class SimulatedAuth implements IAuth {
  private readonly _user: IUser | null;
  private readonly _userHandlers: { [id: string]: ((user: IUser | null) => void) } = {};
  private _isLoggedIn = false;

  constructor(user: IUser | null) {
    this._user = user;
  }

  signInWithPopup(provider: IAuthProvider | undefined) {
    this._isLoggedIn = true;
    for (var id in this._userHandlers) {
      this._userHandlers[id](this._user);
    }
    return Promise.resolve(this._user);
  }

  signOut() {
    this._isLoggedIn = false;
    for (var id in this._userHandlers) {
      this._userHandlers[id](null);
    }
    return Promise.resolve();
  }

  onAuthStateChanged(onNext: (user: IUser | null) => void, onError?: ((e: Error) => void) | undefined) {
    onNext(this._isLoggedIn ? this._user : null);

    var id = uuidv4();
    this._userHandlers[id] = onNext;
    return () => {
      delete this._userHandlers[id];
    }
  }
}

export default FirebaseContextProvider;