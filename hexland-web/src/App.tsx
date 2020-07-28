import React from 'react';
import './App.css';
import { auth } from './firebase';

import Home from './Home';
import Login from './Login';
import Map from './Map';

import { BrowserRouter, Route, Switch } from 'react-router-dom';

interface IAppProps {}

export class AppState {
  user: firebase.User | null = null;
}

export const AppContext = React.createContext(new AppState());

class App extends React.Component<IAppProps, AppState> {
  private _authStateChanged: firebase.Unsubscribe | undefined;

  constructor(props: IAppProps) {
    super(props);
    this.state = new AppState();
  }

  componentDidMount() {
    this._authStateChanged = auth.onAuthStateChanged(u => {
      this.setState({ user: u });
    });
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
