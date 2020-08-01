import React from 'react';
import './App.css';
import { auth } from './firebase';

import { IProfile } from './data/profile';
import { DataService } from './services/dataService';

import Adventure from './Adventure';
import AllPage from './All';
import HomePage from './Home';
import Login from './Login';
import MapPage from './Map';

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

  private async syncProfile(u: firebase.User, dataService: IDataService) {
    var profile = await dataService.getProfile();
    if (profile === undefined) {
      profile = { name: u.displayName ?? "Unknown User", adventures: [], latestMaps: [] };
      await dataService.setProfile(profile);
    }
  }

  componentDidMount() {
    this._authStateChanged = auth.onAuthStateChanged(u => {
      var dataService = u === null ? undefined : new DataService(u.uid);
      this.setState({ user: u, dataService: dataService });

      // Fetch this user's profile.  Create it if it doesn't exist.
      if (u !== null && dataService !== undefined) {
        this.syncProfile(u, dataService)
          .catch(e => console.error("Failed to sync profile: ", e));

        // Watch the profile, in case changes get made elsewhere:
        this._stopWatchingProfile = dataService.watchProfile(
          p => this.setState({ profile: p }),
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
        this.syncProfile(this.state.user, this.state.dataService)
          .catch(e => console.error("Failed to sync profile: ", e));

        // Watch the profile, in case changes get made elsewhere:
        this._stopWatchingProfile = this.state.dataService.watchProfile(
          p => this.setState({ profile: p }),
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
              <Route path="/adventure/:adventureId" component={Adventure} />
              <Route path="/login" component={Login} />
              <Route path="/map/:mapId" component={MapPage} />
            </Switch>
          </BrowserRouter>
        </AppContext.Provider>
      </div>
    );
  }
}

export default App;
