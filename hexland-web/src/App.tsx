import React from 'react';
import './App.css';
import { auth } from './firebase';

import { IProfile } from './data/profile';
import { DataService } from './services/dataService';

import Adventure from './Adventure';
import AllPage from './All';
import Home from './Home';
import Login from './Login';
import Map from './Map';

import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { IDataService } from './services/interfaces';

interface IAppProps {}

export class AppState {
  user: firebase.User | null = null;
  dataService: IDataService | undefined = undefined;
  profile: IProfile | undefined = undefined;
}

// TODO add-recent-map too

export const AppContext = React.createContext(new AppState());

class App extends React.Component<IAppProps, AppState> {
  private _authStateChanged: firebase.Unsubscribe | undefined;

  constructor(props: IAppProps) {
    super(props);
    this.state = new AppState();
  }

  private async syncProfile(u: firebase.User, dataService: IDataService): Promise<IProfile> {
    var profile = await dataService.getProfile();
    if (profile === undefined) {
      profile = { name: u.displayName ?? "Unknown User", adventures: [], latestMaps: [] };
      await dataService.setProfile(profile);
    }

    return profile;
  }

  componentDidMount() {
    this._authStateChanged = auth.onAuthStateChanged(u => {
      var dataService = u === null ? undefined : new DataService(u.uid);
      this.setState({ user: u, dataService: dataService });

      // Fetch this user's profile.  Create it if it doesn't exist.
      if (u !== null && dataService !== undefined) {
        this.syncProfile(u, dataService)
          .then(p => this.setState({ profile: p }))
          .catch(e => console.error("Failed to sync profile: ", e));
      }
    });
  }

  componentDidUpdate(prevProps: IAppProps, prevState: AppState) {
    if (this.state.user?.displayName !== prevState.user?.displayName) {
      console.log("User changed to " + this.state.user?.displayName ?? "(none)");
    }
  }

  componentWillUnmount() {
    if (this._authStateChanged !== undefined) {
      this._authStateChanged();
      this._authStateChanged = undefined;
    }
  }

  render() {
    return (
      <div className="App">
        <AppContext.Provider value={this.state}>
          <BrowserRouter>
            <Switch>
              <Route exact path="/" component={Home} />
              <Route exact path="/all" component={AllPage} />
              <Route path="/adventure/:adventureId" component={Adventure} />
              <Route path="/login" component={Login} />
              <Route path="/map/:geometry" component={Map} />
            </Switch>
          </BrowserRouter>
        </AppContext.Provider>
      </div>
    );
  }
}

export default App;
