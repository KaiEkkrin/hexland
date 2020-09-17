import React, { useContext, useState, useEffect } from 'react';
import './App.css';

import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { FirebaseContext } from './components/FirebaseContextProvider';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';

import { DataService } from './services/dataService';
import { ensureProfile } from './services/extensions';
import { IAuthProvider } from './services/interfaces';

import Button from 'react-bootstrap/Button';
import { useHistory } from 'react-router-dom';

interface ILoginMessageProps {
  isVisible: boolean;
}

function LoginFailedMessage(props: ILoginMessageProps) {
  return props.isVisible ? <p>Login failed.</p> : <div></div>;
}

function LoginSuccessfulMessage(props: ILoginMessageProps) {
  return props.isVisible ? <p>Login successful.</p> : <div></div>;
}

function Login() {
  const firebaseContext = useContext(FirebaseContext);
  const profileContext = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);
  const history = useHistory();

  const [loginFailedVisible, setLoginFailedVisible] = useState(false);
  const [loginSuccessfulVisible, setLoginSuccessfulVisible] = useState(false);

  // Reset those message statuses as appropriate
  useEffect(() => {
    if (profileContext === undefined) {
      setLoginSuccessfulVisible(false);
    } else {
      setLoginFailedVisible(false);
    }
  }, [profileContext]);

  async function doLogin(provider: IAuthProvider) {
    setLoginFailedVisible(false);
    const user = await firebaseContext.auth?.signInWithPopup(provider);
    if (user === undefined) {
      throw Error("Undefined auth context or user");
    }

    if (user === null) {
      setLoginFailedVisible(true);
      return;
    }
    
    if (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined) {
      throw Error("No database available");
    }

    const dataService = new DataService(
      firebaseContext.db,
      firebaseContext.timestampProvider
    );

    await ensureProfile(dataService, user, analyticsContext.analytics);
    setLoginSuccessfulVisible(true);
  }

  function handleGoogleLoginClick() {
    if (firebaseContext.googleAuthProvider !== undefined) {
      doLogin(firebaseContext.googleAuthProvider)
        .then(p => {
          if (history.length > 0) {
            history.goBack();
          } else {
            history.replace("/");
          }
        })
        .catch(e => analyticsContext.logError("Login failed:", e));
    }
  }

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        <Button onClick={handleGoogleLoginClick}>
          Sign in with Google
        </Button>
        <LoginFailedMessage isVisible={loginFailedVisible} />
        <LoginSuccessfulMessage isVisible={loginSuccessfulVisible} />
        <div className="App-login-text">Your account is used only to create a unique player identifier for you.</div>
      </header>
    </div>
  );
}

export default Login;