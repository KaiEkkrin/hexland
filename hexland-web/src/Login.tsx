import React from 'react';
import './App.css';
import { auth, googleAuthProvider } from './firebase';

import { AppContext, AppState } from './App';
import Navigation from './components/Navigation';

import Button from 'react-bootstrap/Button';

import { Redirect } from 'react-router-dom';

function Login() {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user !== null ? <Redirect to="/" /> : (
        <div>
          <Navigation getTitle={() => undefined} />
          <header className="App-header">
            <Button onClick={() => auth.signInWithPopup(googleAuthProvider)}>
              Sign in with Google
            </Button>
          </header>
        </div>
      )}
    </AppContext.Consumer>
  );
}

export default Login;
