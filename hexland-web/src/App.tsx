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

import { Route, Routes } from 'react-router-dom';

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
                      <Routes>
                        <Route path="/" element={<Home />} />
                        <Route path="/all" element={<All />} />
                        <Route path="/adventure/:adventureId" element={<AdventurePage />} />
                        <Route path="/adventure/:adventureId/map/:mapId" element={<MapPage />} />
                        <Route path="/invite/:inviteId" element={<InvitePage />} />
                        <Route path="/login" element={<Login />} />
                        <Route path="/shared" element={<Shared />} />
                      </Routes>
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