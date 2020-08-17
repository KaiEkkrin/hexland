import React from 'react';

import { AppRouting } from './App';
import { FirebaseContext } from './components/FirebaseContextProvider';
import { IContextProviderProps } from './components/interfaces';
import ProfileContextProvider from './components/ProfileContextProvider';
import UserContextProvider from './components/UserContextProvider';

import { StaticRouter, MemoryRouter } from 'react-router-dom';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { initializeTestApp } from '@firebase/testing';
import { IUser, IAuth, IAuthProvider } from './services/interfaces';
import { render } from '@testing-library/react';

import { v4 as uuidv4 } from 'uuid';

// Note that to successfully run tests that use the Firebase emulator you need to have
// this running somewhere:
// `firebase emulators:start --only firestore`

// Simulates the authentication subsystem, which the Firebase emulator doesn't provide.
// TODO Try to make this as a Jest mock instead...  (I expect I'll need to add default
// user parameters and things like that...)
class SimulatedAuth implements IAuth {
  private readonly _user: IUser | null;
  private readonly _userHandlers: { [id: string]: ((user: IUser | null) => void) } = {};
  private _isLoggedIn: boolean;

  constructor(user: IUser | null, isLoggedIn: boolean) {
    this._user = user;
    this._isLoggedIn = isLoggedIn;
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

// This provides a Firebase context using the emulator.
interface ISimulatedProps {
  setApp: (app: firebase.app.App) => void; // exports the app for cleanup
  startLoggedIn: boolean; // TODO Take this away!  There will be no profile if it is true.
                          // It is not realistic and will cause problems for me.
  user: IUser | null | undefined; // null for none, undefined for default (owner)
}

export function SimulatedFirebaseContextProvider(props: ISimulatedProps & IContextProviderProps) {
  const user = props.user !== undefined ? props.user : {
    displayName: 'Owner',
    email: 'owner@example.com',
    uid: 'owner' // the magical does-everything uid.  TODO test with unprivileged users!
  }

  const app = initializeTestApp({
    projectId: uuidv4(),
    auth: user ?? undefined
  });
  props.setApp(app);

  const firebaseContext = {
    auth: new SimulatedAuth(user, props.startLoggedIn),
    db: app.firestore(),
    googleAuthProvider: {},
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp
  };

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      {props.children}
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
      <UserContextProvider>
        <ProfileContextProvider>
          <StaticRouter location={props.location ?? "/"}>
            {props.children}
          </StaticRouter>
        </ProfileContextProvider>
      </UserContextProvider>
    </SimulatedFirebaseContextProvider>
  );
}

// A full application with memory routing.
export function SimulatedApplication(props: ISimulatedComponentProps) {
  return (
    <SimulatedFirebaseContextProvider {...props}>
      <UserContextProvider>
        <ProfileContextProvider>
          <MemoryRouter initialEntries={[props.location ?? '/']}>
            <AppRouting />
          </MemoryRouter>
        </ProfileContextProvider>
      </UserContextProvider>
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