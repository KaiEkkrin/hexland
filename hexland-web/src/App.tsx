import React from 'react';
import './App.css';

import AdventurePage from './Adventure';
import All from './All';
import FirebaseContextProvider from './components/FirebaseContextProvider';
import Home from './Home';
import InvitePage from './Invite';
import Login from './Login';
import MapPage from './Map';
import ProfileContextProvider from './components/ProfileContextProvider';
import Shared from './Shared';
import Status from './components/Status';
import UserContextProvider from './components/UserContextProvider';

import { BrowserRouter, Route, Switch } from 'react-router-dom';

export function AppRouting() { // exported for testing purposes only :)
  return (
    <Switch>
      <Route exact path="/" component={Home} />
      <Route exact path="/all" component={All} />
      <Route exact path="/adventure/:adventureId" component={AdventurePage} />
      <Route exact path="/adventure/:adventureId/invite/:inviteId" component={InvitePage} />
      <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
      <Route exact path="/login" component={Login} />
      <Route exact page="/shared" component={Shared} />
    </Switch>
  );
}

function App() {
  return (
    <div className="App">
      <FirebaseContextProvider>
        <UserContextProvider>
          <ProfileContextProvider>
            <BrowserRouter>
              <AppRouting />
            </BrowserRouter>
            <Status />
          </ProfileContextProvider>
        </UserContextProvider>
      </FirebaseContextProvider>
    </div>
  );
}

export default App;