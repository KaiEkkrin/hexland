import React, { useState } from 'react';
import { Route, Switch } from 'react-router-dom';

import './App.css';

import { MuiThemeProvider } from '@material-ui/core/styles';

import theme from './theme';

import AdventurePage from './Adventure';
import All from './All';
import { AnalyticsContextProvider } from './components/AnalyticsContextProvider';
import Consent from './components/Consent';
import FirebaseContextProvider from './components/FirebaseContextProvider';
import Home from './Home';
import InvitePage from './Invite';
import Login from './Login';
import MapPage from './Map';
import Navigation from './components/Navigation';
import ProfileContextProvider from './components/ProfileContextProvider';
import Routing from './components/Routing';
import { IRoutingProps, IFirebaseProps, IAnalyticsProps } from './components/interfaces';
import Shared from './Shared';
import Status from './components/Status';
import StatusContextProvider from './components/StatusContextProvider';
import ToastCollection from './components/ToastCollection';
import UserContextProvider from './components/UserContextProvider';

function App(props: IFirebaseProps & IRoutingProps & IAnalyticsProps) {
  const [title, setTitle] = useState<string | JSX.Element>("");
  const navbarProps = {
    navbarTitle: title,
    setNavbarTitle: setTitle,
  };
//
  return (
    <div className="App">
      <MuiThemeProvider theme={ theme }>
        <FirebaseContextProvider {...props}>
          <UserContextProvider>
            <AnalyticsContextProvider {...props}>
              <ProfileContextProvider>
                <StatusContextProvider>
                  <Routing {...props}>
                    <Navigation>{title}</Navigation>
                    <Switch>
                      <Route exact path="/" render={props => (
                        <Home {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/all" render={props => (
                        <All {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/adventure/:adventureId" render={props => (
                        <AdventurePage {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/adventure/:adventureId/invite/:inviteId" render={props => (
                        <InvitePage {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/adventure/:adventureId/map/:mapId" render={props => (
                        <MapPage {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/login" render={props => (
                        <Login {...navbarProps} {...props} />
                      )}/>
                      <Route exact path="/shared" render={props => (
                        <Shared {...navbarProps} {...props} />
                      )}/>
                    </Switch>
                  </Routing>
                  <Consent />
                  <Status />
                  <ToastCollection />
                </StatusContextProvider>
              </ProfileContextProvider>
            </AnalyticsContextProvider>
          </UserContextProvider>
        </FirebaseContextProvider>
      </MuiThemeProvider>
    </div>
  );
}

export default App;