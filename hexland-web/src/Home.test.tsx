import React from 'react';

import { FirebaseContext, IContextProviderProps, ProfileContextProvider, UserContext } from './App';
import HomePage from './Home';

import { DataService } from './services/dataService';

import * as firebase from 'firebase/app';
import { initializeTestApp } from '@firebase/testing';

import { StaticRouter } from 'react-router-dom';

import { render } from '@testing-library/react';

// This provides a Firebase context and user context using the simulator.
export function SimulatedFirebaseContextProvider(props: IContextProviderProps) {
  const user = {
    displayName: 'Owner',
    email: 'owner@example.com',
    uid: 'owner' // the magical does-everything uid.  TODO test with unprivileged users!
  };

  const app = initializeTestApp({
    projectId: 'hexland-test',
    auth: user
  });

  // TODO wipe the existing simulated database first?

  const firebaseContext = {
    db: app.firestore(),
    auth: undefined,
    googleAuthProvider: new firebase.auth.GoogleAuthProvider(),
    timestampProvider: firebase.firestore.FieldValue.serverTimestamp
  };

  const userContext = {
    user: user,
    dataService: new DataService(firebaseContext.db, firebaseContext.timestampProvider, user.uid)
  };

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      <UserContext.Provider value={userContext}>
        {props.children}
      </UserContext.Provider>
    </FirebaseContext.Provider>
  );
}

test('latest maps and latest adventures headings are there', () => {
  const { getByText } = render(
    <SimulatedFirebaseContextProvider>
      <ProfileContextProvider>
        <StaticRouter location="/">
          <HomePage />
        </StaticRouter>
      </ProfileContextProvider>
    </SimulatedFirebaseContextProvider>
  );

  const brandElement = getByText(/hexland/i);
  expect(brandElement).toBeInTheDocument();

  const latestMapsElement = getByText(/Latest maps/);
  expect(latestMapsElement).toBeInTheDocument();

  const latestAdventuresElement = getByText(/Latest adventures/);
  expect(latestAdventuresElement).toBeInTheDocument();
});