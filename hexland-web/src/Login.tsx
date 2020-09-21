import React, { useCallback, useContext, useState, useEffect, useMemo } from 'react';
import './App.css';

import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { FirebaseContext } from './components/FirebaseContextProvider';
import Navigation from './components/Navigation';
import * as Policy from './components/policy';
import { ProfileContext } from './components/ProfileContextProvider';

import { DataService } from './services/dataService';
import { ensureProfile } from './services/extensions';
import { IUser } from './services/interfaces';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import { useHistory } from 'react-router-dom';

interface ILoginMessageProps {
  isVisible: boolean;
}

function LoginFailedMessage(props: ILoginMessageProps) {
  return props.isVisible ? <p style={{ color: "red" }}>Login failed.</p> : <div></div>;
}

interface INewUserFormProps {
  shown: boolean;
  handleClose: () => void;
  handleSignIn: (email: string, password: string) => void;
  handleSignUp: (displayName: string, email: string, password: string) => void;
}

function EmailPasswordModal(props: INewUserFormProps) {
  const [key, setKey] = useState("new");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // reset the password fields when the shown status changes
  useEffect(() => {
    if (props.shown === true) {
      setPassword("");
      setConfirmPassword("");
    }
  }, [props.shown]);

  const signInDisabled = useMemo(() => {
    if (!Policy.emailIsValid(email) || !Policy.passwordIsValid(password)) {
      return true;
    }

    if (key === 'new' && (displayName.length === 0 || confirmPassword !== password)) {
      return true;
    }

    return false;
  }, [displayName, email, key, password, confirmPassword]);

  const signInText = useMemo(() => key === 'new' ? 'Sign up' : 'Sign in', [key]);

  const handleSave = useCallback(() => {
    if (key === 'new') {
      props.handleSignUp(displayName, email, password);
    } else {
      props.handleSignIn(email, password);
    }
  }, [displayName, email, key, password, props]);

  return (
    <Modal show={props.shown} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Sign in with an email address and password</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs activeKey={key} onSelect={k => setKey(k ?? "new")} id="signIn">
          <Tab eventKey="new" title="New user">
            <Form>
              <Form.Group>
                <Form.Label htmlFor="nameInput">Display name</Form.Label>
                <Form.Control id="nameInput" type="text" value={displayName}
                  onChange={e => setDisplayName(e.target.value)} />
                <Form.Text className="text-muted">
                  This is the name that will be shown to other users of Wall &amp; Shadow.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="newEmailInput">Email address</Form.Label>
                <Form.Control id="newEmailInput" type="text" value={email}
                  onChange={e => setEmail(e.target.value)} />
                <Form.Text className="text-muted">
                  Other users of Wall &amp; Shadow will not see your email address.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="newPasswordInput">Password</Form.Label>
                <Form.Control id="newPasswordInput" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} />
                <Form.Text className="text-muted">
                  Your password must be at least 8 characters long and contain at least one letter and one number.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="confirmPasswordInput">Confirm password</Form.Label>
                <Form.Control id="confirmPasswordInput" type="password" value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)} />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="existing" title="Existing user">
            <Form>
              <Form.Group>
                <Form.Label htmlFor="emailInput">Email address</Form.Label>
                <Form.Control id="emailInput" type="text" value={email}
                  onChange={e => setEmail(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="passwordInput">Password</Form.Label>
                <Form.Control id="passwordInput" type="password" value={password}
                  onChange={e => setPassword(e.target.value)} />
              </Form.Group>
            </Form>
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={signInDisabled} onClick={handleSave}>{signInText}</Button>
      </Modal.Footer>
    </Modal>
  );
}

function Login() {
  const firebaseContext = useContext(FirebaseContext);
  const profileContext = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);
  const history = useHistory();

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [loginFailedVisible, setLoginFailedVisible] = useState(false);

  // Reset those message statuses as appropriate
  useEffect(() => {
    if (profileContext !== undefined) {
      setLoginFailedVisible(false);
    }
  }, [profileContext, setLoginFailedVisible]);

  const handleLoginResult = useCallback(async (user: IUser | null | undefined, newDisplayName?: string | undefined) => {
    if (user === undefined) {
      throw Error("Undefined auth context or user");
    }

    if (user === null) {
      setLoginFailedVisible(true);
      return false;
    }
    
    if (firebaseContext.db === undefined || firebaseContext.timestampProvider === undefined) {
      throw Error("No database available");
    }

    const dataService = new DataService(
      firebaseContext.db,
      firebaseContext.timestampProvider
    );

    // TODO Use the display name property.  (At first try this didn't work...)
    // if (newDisplayName !== undefined) {
    //   user.displayName = newDisplayName;
    //   await user.updateProfile({ displayName: newDisplayName });
    // }

    if (newDisplayName !== undefined) {
      await ensureProfile(dataService, { ...user, displayName: newDisplayName }, analyticsContext.analytics);
    } else {
      await ensureProfile(dataService, user, analyticsContext.analytics);
    }
    return true;
  }, [analyticsContext, firebaseContext, setLoginFailedVisible]);

  const finishLogin = useCallback((success: boolean) => {
    if (success) {
      if (history.length > 0) {
        history.goBack();
      } else {
        history.replace("/");
      }
    }
  }, [history]);

  const handleLoginError = useCallback((e: any) => {
    setLoginFailedVisible(true);
  }, [setLoginFailedVisible]);

  const handleEmailFormClose = useCallback(() => {
    setShowEmailForm(false);
  }, [setShowEmailForm]);

  const handleEmailFormSignUp = useCallback((displayName: string, email: string, password: string) => {
    setShowEmailForm(false);
    setLoginFailedVisible(false);
    firebaseContext.auth?.createUserWithEmailAndPassword(email, password)
      .then(u => handleLoginResult(u, displayName))
      .then(finishLogin)
      .catch(handleLoginError);
  }, [firebaseContext, finishLogin, handleLoginError, handleLoginResult, setLoginFailedVisible, setShowEmailForm]);

  const handleEmailFormSignIn = useCallback((email: string, password: string) => {
    setShowEmailForm(false);
    setLoginFailedVisible(false);
    firebaseContext.auth?.signInWithEmailAndPassword(email, password)
      .then(handleLoginResult)
      .then(finishLogin)
      .catch(handleLoginError);
  }, [firebaseContext, finishLogin, handleLoginError, handleLoginResult, setLoginFailedVisible, setShowEmailForm]);

  const handleEmailLoginClick = useCallback(() => {
    setShowEmailForm(true);
  }, [setShowEmailForm]);

  const handleGoogleLoginClick = useCallback(() => {
    setLoginFailedVisible(false);
    if (firebaseContext.googleAuthProvider !== undefined) {
      firebaseContext.auth?.signInWithPopup(firebaseContext.googleAuthProvider)
        .then(handleLoginResult)
        .then(finishLogin)
        .catch(handleLoginError);
    }
  }, [finishLogin, firebaseContext, handleLoginError, handleLoginResult, setLoginFailedVisible]);

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        <div className="App-login-text">
          Sign in to get started with Wall &amp; Shadow.
        </div>
        <Button onClick={handleEmailLoginClick}>Sign in with an email address and password</Button>
        <Button className="mt-2" onClick={handleGoogleLoginClick}>Sign in with Google</Button>
        <LoginFailedMessage isVisible={loginFailedVisible} />
        <div className="App-login-text">
          Your account is used to create a unique player identifier for you.
          After signing in, you can click on your name button at the top right to change the name shown to other players.
        </div>
      </header>
      <EmailPasswordModal shown={showEmailForm} handleClose={handleEmailFormClose}
        handleSignIn={handleEmailFormSignIn}
        handleSignUp={handleEmailFormSignUp} />
    </div>
  );
}

export default Login;