import React from 'react';

import { AppRouting } from './App';
import { FirebaseContext, UserContext } from './components/FirebaseContextProvider';
import { IContextProviderProps } from './components/interfaces';
import ProfileContextProvider from './components/ProfileContextProvider';

import { DataService } from './services/dataService';

import { StaticRouter, MemoryRouter } from 'react-router-dom';

import * as firebase from 'firebase/app';
import { initializeTestApp } from '@firebase/testing';
import { IUser, IAuth, IAuthProvider } from './services/interfaces';
import { render } from '@testing-library/react';

import { v4 as uuidv4 } from 'uuid';

// Simulates the authentication subsystem, which the Firebase emulator doesn't provide.
// TODO Try to make this as a Jest mock instead...  (I expect I'll need to add default
// user parameters and things like that...)
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

// This provides a Firebase context and user context using the emulator.
interface ISimulatedProps {
  setApp: (app: firebase.app.App) => void; // exports the app for cleanup
  user: IUser | null | undefined; // null for none, undefined for default (owner)
}

export function SimulatedFirebaseContextProvider(props: ISimulatedProps & IContextProviderProps) {
  const user = props.user !== undefined ? props.user : {
    displayName: 'Owner',
    email: 'owner@example.com',
    uid: 'owner' // the magical does-everything uid.  TODO test with unprivileged users!
  }

  const app = initializeTestApp({
    projectId: 'hexland-test',
    auth: user ?? undefined
  });
  props.setApp(app);

  // TODO wipe the existing simulated database first?

  const firebaseContext = {
    db: app.firestore(),
    auth: new SimulatedAuth(user),
    googleAuthProvider: {},
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp
  };

  const userContext = {
    user: user,
    dataService: user != null ? new DataService(firebaseContext.db, firebaseContext.timestampProvider, user.uid) :
      undefined
  };

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      <UserContext.Provider value={userContext}>
        {props.children}
      </UserContext.Provider>
    </FirebaseContext.Provider>
  );
}

// A statically routed single page component for testing.
interface ISimulatedComponentProps extends ISimulatedProps {
  location?: string | undefined;
}

export function SimulatedSingleComponent(props: ISimulatedComponentProps & IContextProviderProps) {
  return (
    <SimulatedFirebaseContextProvider {...props}>
      <ProfileContextProvider>
        <StaticRouter location={props.location ?? "/"}>
          {props.children}
        </StaticRouter>
      </ProfileContextProvider>
    </SimulatedFirebaseContextProvider>
  );
}

// A full application with memory routing.
export function SimulatedApplication(props: ISimulatedComponentProps) {
  return (
    <SimulatedFirebaseContextProvider {...props}>
      <ProfileContextProvider>
        <MemoryRouter initialEntries={[ props.location ?? '/' ]}>
          <AppRouting />
        </MemoryRouter>
      </ProfileContextProvider>
    </SimulatedFirebaseContextProvider>
  );
}

test('login and create adventure', () => {
  // // This should show the login element...
  // const { getByText } = render(
  //   <SimulatedApplication user={null} />
  // )

  // const loginElement = getByText(/login/i);
  // expect(loginElement).toBeInTheDocument();

  // // TODO test for automatic redirect
});