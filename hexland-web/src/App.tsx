import './App.css';

import { lazy, Suspense } from 'react';

import AdventureContextProvider from './components/AdventureContextProvider';
import { AnalyticsContextProvider } from './components/AnalyticsContextProvider';
import Consent from './components/Consent';
import FirebaseContextProvider from './components/FirebaseContextProvider';
import Home from './Home';
import MapContextProvider from './components/MapContextProvider';
import ProfileContextProvider from './components/ProfileContextProvider';
import Routing from './components/Routing';
import { IRoutingProps, IFirebaseProps, IAnalyticsProps } from './components/interfaces';
import Status from './components/Status';
import StatusContextProvider from './components/StatusContextProvider';
import Throbber from './components/Throbber';
import ToastCollection from './components/ToastCollection';
import UserContextProvider from './components/UserContextProvider';

import { Route, Routes } from 'react-router-dom';

// Lazy-loaded route components for code splitting
const AdventurePage = lazy(() => import('./Adventure'));
const All = lazy(() => import('./All'));
const InvitePage = lazy(() => import('./Invite'));
const Login = lazy(() => import('./Login'));
const MapPage = lazy(() => import('./Map'));
const Shared = lazy(() => import('./Shared'));

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
                      <Suspense fallback={<Throbber />}>
                        <Routes>
                          <Route path="/" element={<Home />} />
                          <Route path="/all" element={<All />} />
                          <Route path="/adventure/:adventureId" element={<AdventurePage />} />
                          <Route path="/adventure/:adventureId/map/:mapId" element={<MapPage />} />
                          <Route path="/invite/:inviteId" element={<InvitePage />} />
                          <Route path="/login" element={<Login />} />
                          <Route path="/shared" element={<Shared />} />
                        </Routes>
                      </Suspense>
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