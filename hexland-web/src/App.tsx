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
import Routing from './components/Routing';
import { IRoutingProps, IFirebaseProps } from './components/interfaces';
import Shared from './Shared';
import Status from './components/Status';
import StatusContextProvider from './components/StatusContextProvider';
import ToastCollection from './components/ToastCollection';
import UserContextProvider from './components/UserContextProvider';

import { Route, Switch } from 'react-router-dom';

function App(props: IFirebaseProps & IRoutingProps) {
  return (
    <div className="App">
      <FirebaseContextProvider {...props}>
        <UserContextProvider>
          <ProfileContextProvider>
            <StatusContextProvider>
              <Routing {...props}>
                <Switch>
                  <Route exact path="/" component={Home} />
                  <Route exact path="/all" component={All} />
                  <Route exact path="/adventure/:adventureId" component={AdventurePage} />
                  <Route exact path="/adventure/:adventureId/invite/:inviteId" component={InvitePage} />
                  <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
                  <Route exact path="/login" component={Login} />
                  <Route exact page="/shared" component={Shared} />
                </Switch>
              </Routing>
              <Status />
              <ToastCollection />
            </StatusContextProvider>
          </ProfileContextProvider>
        </UserContextProvider>
      </FirebaseContextProvider>
    </div>
  );
}

export default App;