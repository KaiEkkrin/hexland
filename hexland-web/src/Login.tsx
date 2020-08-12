import React, { useContext } from 'react';
import './App.css';
import { auth, googleAuthProvider } from './firebase';

import { UserContext } from './App';
import Navigation from './components/Navigation';

import Button from 'react-bootstrap/Button';

import { Redirect } from 'react-router-dom';

function Login() {
  var userContext = useContext(UserContext);
  return userContext.user !== null ? <Redirect to="/" /> : (
    <div>
      <Navigation getTitle={() => undefined} />
      <header className="App-header">
        <Button onClick={() => auth.signInWithPopup(googleAuthProvider)}>
          Sign in with Google
            </Button>
      </header>
    </div>
  );
}

export default Login;
