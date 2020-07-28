import React from 'react';
import './App.css';
import { auth, googleAuthProvider } from './firebase';
import Navigation from './Navigation';

import Button from 'react-bootstrap/Button';

function Login() {
  return (
    <div className="App">
      <Navigation />
      <header className="App-header">
        <Button onClick={() => auth.signInWithPopup(googleAuthProvider)}>
          Sign in with Google
        </Button>
      </header>
    </div>
  );
}

export default Login;
