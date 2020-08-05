import React from 'react';
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

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { IDataService } from './services/interfaces';

interface IAppProps {}

export class AppState {
  user: firebase.User | null = null;
  dataService: IDataService | undefined = undefined;
  profile: IProfile | undefined = undefined;
}

export const AppContext = React.createContext(new AppState());

class App extends React.Component<IAppProps, AppState> {
  private _authStateChanged: firebase.Unsubscribe | undefined;
  private _stopWatchingProfile: (() => void) | undefined;

  constructor(props: IAppProps) {
    super(props);
    this.state = new AppState();
  }

  private setProfile(
    u: firebase.User | null,
    dataService: IDataService | undefined,
    profile: IProfile | undefined
  ) {
    this.setState({ profile: profile });
    if (profile === undefined) {
      // This user doesn't have a profile yet -- create it
      var displayName = u?.displayName ?? "Unknown User";
      dataService?.setProfile({
        name: displayName,
        adventures: [],
        latestMaps: []
      })
        .then(() => console.log("Created profile for " + displayName))
        .catch(e => console.error("Failed to create profile for " + displayName, e));
    }
  }

  componentDidMount() {
    this._authStateChanged = auth.onAuthStateChanged(u => {
      var dataService = u === null ? undefined : new DataService(u.uid);
      this.setState({ user: u, dataService: dataService });

      if (u !== null && dataService !== undefined) {
        // Watch the profile, in case changes get made elsewhere:
        this._stopWatchingProfile = dataService.watchProfile(
          p => this.setProfile(u, dataService, p),
          e => console.error("Failed to watch profile: ", e)
        );
      }
    });
  }

  componentDidUpdate(prevProps: IAppProps, prevState: AppState) {
    if (this.state.user?.uid !== prevState.user?.uid) {
      console.log("User changed to " + this.state.user?.displayName ?? "(none)");

      // Sync and watch the new user's profile instead
      this._stopWatchingProfile?.();
      if (this.state.user !== null && this.state.dataService !== undefined) {
        // Watch the profile, in case changes get made elsewhere:
        this._stopWatchingProfile = this.state.dataService.watchProfile(
          p => this.setProfile(this.state.user, this.state.dataService, p),
          e => console.error("Failed to watch profile: ", e)
        );
      }
    }
  }

  componentWillUnmount() {
    this._stopWatchingProfile?.();
    this._stopWatchingProfile = undefined;

    this._authStateChanged?.();
    this._authStateChanged = undefined;
  }

  render() {
    return (
      <div className="App">
        <AppContext.Provider value={this.state}>
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
        </AppContext.Provider>
      </div>
    );
  }
}

export default App;
