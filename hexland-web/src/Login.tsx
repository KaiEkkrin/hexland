import React, { useContext } from 'react';
import './App.css';

import { FirebaseContext } from './App';
import Navigation from './components/Navigation';

import { DataService } from './services/dataService';
import { ensureProfile } from './services/extensions';

import Button from 'react-bootstrap/Button';
import { useHistory } from 'react-router-dom';

function Login() {
  const firebaseContext = useContext(FirebaseContext);
  const history = useHistory();

  async function doLogin(provider: firebase.auth.AuthProvider) {
    const credential = await firebaseContext.auth?.signInWithPopup(provider);
    if (!credential?.user) {
      return Promise.reject("Undefined auth context or user");
    }
    
    if (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined) {
      return Promise.reject("No database available");
    }

    const dataService = new DataService(
      firebaseContext.db,
      firebaseContext.timestampProvider,
      credential.user.uid
    );
    return await ensureProfile(dataService, {
      displayName: credential.user.displayName,
      email: credential.user.email,
      uid: credential.user.uid
    });
  }

  function handleGoogleLoginClick() {
    if (firebaseContext.googleAuthProvider !== undefined) {
      doLogin(firebaseContext.googleAuthProvider)
        .then(p => history.push("/"))
        .catch(e => console.error("Login failed:", e));
    }
  }

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        <Button onClick={handleGoogleLoginClick}>
          Sign in with Google
        </Button>
      </header>
    </div>
  );
}

export default Login;
