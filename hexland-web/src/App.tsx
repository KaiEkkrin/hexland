import React, { useEffect, useState, useContext } from 'react';
import './App.css';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { IProfile } from './data/profile';
import { DataService } from './services/dataService';

import AdventurePage from './Adventure';
import AllPage from './All';
import HomePage from './Home';
import InvitePage from './Invite';
import Login from './Login';
import MapPage from './Map';
import SharedPage from './Shared';
import Status from './components/Status';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { IDataService, IUser } from './services/interfaces';

export interface IFirebaseContext {
  auth: firebase.auth.Auth | undefined;
  db: firebase.firestore.Firestore | undefined;
  googleAuthProvider: firebase.auth.GoogleAuthProvider | undefined;
  timestampProvider: (() => firebase.firestore.FieldValue) | undefined;
}

export const FirebaseContext = React.createContext<IFirebaseContext>({
  auth: undefined,
  db: undefined,
  googleAuthProvider: undefined,
  timestampProvider: undefined
});

export interface IUserContext {
  user: IUser | undefined;
  dataService: IDataService | undefined;
}

export const UserContext = React.createContext<IUserContext>({
  user: undefined,
  dataService: undefined
});

export const ProfileContext = React.createContext<IProfile | undefined>(undefined);

export interface IContextProviderProps {
  children: React.ReactNode;
}

// This provides the Firebase and user contexts, and should be replaced to unit test with the
// Firebase simulator.
export function FirebaseContextProvider(props: IContextProviderProps) {
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
      auth: app.auth(),
      db: app.firestore(),
      googleAuthProvider: new firebase.auth.GoogleAuthProvider(),
      timestampProvider: firebase.firestore.FieldValue.serverTimestamp
    });
  }

  useEffect(() => {
    configureFirebase()
      .catch(e => console.error("Error configuring Firebase", e));
  }, []);

  const [userContext, setUserContext] = useState<IUserContext>({ user: undefined, dataService: undefined });

  // When we're connected to Firebase, subscribe to the auth state change event and create a
  // suitable user context
  useEffect(() => {
    return firebaseContext.auth?.onAuthStateChanged(u => {
      console.log("Creating user context from " + u?.uid);
      setUserContext({
        user: (u === null || u === undefined) ? undefined : { displayName: u.displayName, email: u.email, uid: u.uid },
        dataService: (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined || u === null || u === undefined) ?
          undefined : new DataService(firebaseContext.db, firebaseContext.timestampProvider, u.uid)
      });
    });
  }, [firebaseContext.auth, firebaseContext.db, firebaseContext.timestampProvider]);

  return (
    <FirebaseContext.Provider value={firebaseContext}>
      <UserContext.Provider value={userContext}>
        {props.children}
      </UserContext.Provider>
    </FirebaseContext.Provider>
  );
}

// This provides the profile context, and can be wrapped around individual components
// for unit testing.
export function ProfileContextProvider(props: IContextProviderProps) {
  const userContext = useContext(UserContext);
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // Watch the user's profile:
  useEffect(() => {
    var d = userContext.dataService?.getProfileRef();
    if (d !== undefined) {
      return userContext.dataService?.watch(d,
        p => setProfile(p),
        e => console.error("Failed to watch profile:", e)
      );
    } else {
      setProfile(undefined);
    }
  }, [userContext]);

  return (
    <ProfileContext.Provider value={profile}>
      {props.children}
    </ProfileContext.Provider>
  );
}

function App() {
  return (
    <div className="App">
      <FirebaseContextProvider>
        <ProfileContextProvider>
          <BrowserRouter>
            <Switch>
              <Route exact path="/" component={HomePage} />
              <Route exact path="/all" component={AllPage} />
              <Route exact path="/adventure/:adventureId" component={AdventurePage} />
              <Route exact path="/adventure/:adventureId/invite/:inviteId" component={InvitePage} />
              <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
              <Route exact path="/login" component={Login} />
              <Route exact page="/shared" component={SharedPage} />
            </Switch>
          </BrowserRouter>
          <Status />
        </ProfileContextProvider>
      </FirebaseContextProvider>
    </div>
  );
}

export default App;