import React, { useEffect, useState } from 'react';
import './App.css';
import { auth } from './firebase';

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
  const [userContext, setUserContext] = useState<IUserContext>({ user: null, dataService: undefined });
  const [profile, setProfile] = useState<IProfile | undefined>(undefined);

  // On mount, subscribe to the auth state change event and create a suitable user context
  useEffect(() => {
    return auth.onAuthStateChanged(u => {
      setUserContext({
        user: u,
        dataService: u === null ? undefined : new DataService(u.uid)
      });
    });
  }, []);

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
      <Status />
    </div>
  );
}

export default App;