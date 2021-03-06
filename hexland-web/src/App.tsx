import './App.css';

import AdventureContextProvider from './components/AdventureContextProvider';
import AdventurePage from './Adventure';
import All from './All';
import { AnalyticsContextProvider } from './components/AnalyticsContextProvider';
import Consent from './components/Consent';
import FirebaseContextProvider from './components/FirebaseContextProvider';
import Home from './Home';
import InvitePage from './Invite';
import Login from './Login';
import MapPage from './Map';
import MapContextProvider from './components/MapContextProvider';
import ProfileContextProvider from './components/ProfileContextProvider';
import Routing from './components/Routing';
import { IRoutingProps, IFirebaseProps, IAnalyticsProps } from './components/interfaces';
import Shared from './Shared';
import Status from './components/Status';
import StatusContextProvider from './components/StatusContextProvider';
import ToastCollection from './components/ToastCollection';
import UserContextProvider from './components/UserContextProvider';

import { Route, Switch } from 'react-router-dom';

function App(props: IFirebaseProps & IRoutingProps & IAnalyticsProps) {
  return (
    <div className="App">
      <FirebaseContextProvider {...props}>
        <UserContextProvider>
          <AnalyticsContextProvider {...props}>
            <ProfileContextProvider>
              <StatusContextProvider>
                <Routing {...props}>
                  <AdventureContextProvider>
                    <MapContextProvider>
                      <Switch>
                        <Route exact path="/" component={Home} />
                        <Route exact path="/all" component={All} />
                        <Route exact path="/adventure/:adventureId" component={AdventurePage} />
                        <Route exact path="/adventure/:adventureId/map/:mapId" component={MapPage} />
                        <Route exact path="/invite/:inviteId" component={InvitePage} />
                        <Route exact path="/login" component={Login} />
                        <Route exact path="/shared" component={Shared} />
                      </Switch>
                    </MapContextProvider>
                  </AdventureContextProvider>
                </Routing>
                <Consent />
                <Status />
                <ToastCollection />
              </StatusContextProvider>
            </ProfileContextProvider>
          </AnalyticsContextProvider>
        </UserContextProvider>
      </FirebaseContextProvider>
    </div>
  );
}

export default App;