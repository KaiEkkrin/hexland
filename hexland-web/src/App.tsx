import React, { useEffect, useState } from 'react';
import './App.css';

import * as firebase from 'firebase/app';
import 'firebase/auth';
import 'firebase/firestore';

import { IProfile } from './data/profile';
import { DataService } from './services/dataService';

import Adventure from './Adventure';
import AllPage from './All';
import HomePage from './Home';
import InvitePage from './Invite';
import Login from './Login';
import MapPage from './Map';
import SharedPage from './Shared';
import Status from './components/Status';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { IDataService } from './services/interfaces';

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
  user: firebase.User | null;
  dataService: IDataService | undefined;
}

export const UserContext = React.createContext<IUserContext>({
  user: null,
  dataService: undefined
});

export const ProfileContext = React.createContext<IProfile | undefined>(undefined);

function App() {
  const [firebaseContext, setFirebaseContext] = useState<IFirebaseContext>({
    auth: undefined,
    db: undefined,
    googleAuthProvider: undefined,
    timestampProvider: undefined
  });
  const [userContext, setUserContext] = useState<IUserContext>({ user: null, dataService: undefined });
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // On load, fetch our Firebase config and initialize
  async function configureFirebase() {
    var response = await fetch('/__/firebase/init.json');
    firebase.initializeApp(await response.json());
    setFirebaseContext({
      auth: firebase.auth(),
      db: firebase.firestore(),
      googleAuthProvider: new firebase.auth.GoogleAuthProvider(),
      timestampProvider: firebase.firestore.FieldValue.serverTimestamp
    });
  }

  useEffect(() => {
    configureFirebase().catch(e => console.error("Error configuring Firebase", e));
  }, []);

  // When we're connected to Firebase, subscribe to the auth state change event and create a
  // suitable user context
  useEffect(() => {
    return firebaseContext.auth?.onAuthStateChanged(u => {
      setUserContext({
        user: u,
        dataService: (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined || u === null) ?
          undefined : new DataService(firebaseContext.db, firebaseContext.timestampProvider, u.uid)
      });
    });
  }, [firebaseContext.auth, firebaseContext.db, firebaseContext.timestampProvider]);

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
    <div className="App">
      <FirebaseContext.Provider value={firebaseContext}>
        <UserContext.Provider value={userContext}>
          <ProfileContext.Provider value={profile}>
            <BrowserRouter>
              <Switch>
                <Route exact path="/" component={HomePage} />
                <Route exact path="/all" component={AllPage} />
                <Route exact path="/adventure/:adventureId" component={Adventure} />
                <Route exact path="/adventure/:adventureId/invite/:inviteId" component={InvitePage} />
                <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
                <Route exact path="/login" component={Login} />
                <Route exact page="/shared" component={SharedPage} />
              </Switch>
            </BrowserRouter>
          </ProfileContext.Provider>
        </UserContext.Provider>
      </FirebaseContext.Provider>
      <Status />
    </div>
  );
}

export default App;