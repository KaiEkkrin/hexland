import React from 'react';
import './App.css';

import Home from './Home';
import Login from './Login';
import Map from './Map';

import { BrowserRouter, Route, Switch } from 'react-router-dom';

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <Switch>
          <Route exact path="/" component={Home} />
          <Route path="/login" component={Login} />
          <Route path="/map/:geometry" component={Map} />
        </Switch>
      </BrowserRouter>
    </div>
  );
}

export default App;
