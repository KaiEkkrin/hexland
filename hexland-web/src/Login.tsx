import React, { useContext } from 'react';
import './App.css';

import { UserContext, FirebaseContext } from './App';
import Navigation from './components/Navigation';

import Button from 'react-bootstrap/Button';

import { Redirect } from 'react-router-dom';

function Login() {
  var firebaseContext = useContext(FirebaseContext);
  var userContext = useContext(UserContext);

  function handleLoginClick() {
    if (firebaseContext.googleAuthProvider !== undefined) {
      firebaseContext.auth?.signInWithPopup(firebaseContext.googleAuthProvider);
    }
  }

  return userContext.user !== null ? <Redirect to="/" /> : (
    <div>
      <Navigation getTitle={() => undefined} />
      <header className="App-header">
        <Button onClick={handleLoginClick}>
          Sign in with Google
        </Button>
      </header>
    </div>
  );
}

export default Login;
