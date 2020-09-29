import React, { useContext, useMemo, useCallback, useState, useEffect } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { FirebaseContext } from './FirebaseContextProvider';
import { ProfileContext } from './ProfileContextProvider';
import * as Policy from '../data/policy';
import { StatusContext } from './StatusContextProvider';
import { SignInMethodsContext, UserContext } from './UserContextProvider';
import { updateProfile } from '../services/extensions';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import Form from 'react-bootstrap/Form';
import FormCheck from 'react-bootstrap/FormCheck';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

import Measure from 'react-measure';
import { LinkContainer } from 'react-router-bootstrap';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck } from '@fortawesome/free-solid-svg-icons';

import { v4 as uuidv4 } from 'uuid';

interface IChangePasswordModalProps {
  shown: boolean;
  handleClose: () => void;
  handleChange: (oldPassword: string, newPassword: string) => void;
}

function ChangePasswordModal(props: IChangePasswordModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const changeDisabled = useMemo(
    () => !(oldPassword.length > 0 && Policy.passwordIsValid(newPassword) && confirmPassword === newPassword),
    [oldPassword, newPassword, confirmPassword]
  );

  const handleChange = useCallback(
    () => props.handleChange(oldPassword, newPassword),
    [props, oldPassword, newPassword]
  );

  return (
    <Modal show={props.shown} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Change password</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form.Group>
          <Form.Label htmlFor="oldPasswordInput">Old password</Form.Label>
          <Form.Control id="oldPasswordInput" type="password" value={oldPassword}
            onChange={e => setOldPassword(e.target.value)} />
        </Form.Group>
        <Form.Group>
          <Form.Label htmlFor="newPasswordInput">New password</Form.Label>
          <Form.Control id="newPasswordInput" type="password" value={newPassword}
            onChange={e => setNewPassword(e.target.value)} />
          <Form.Text className="text-muted">
            Your password must be at least 8 characters long and contain at least one letter and one number.
          </Form.Text>
        </Form.Group>
        <Form.Group>
          <Form.Label htmlFor="confirmPasswordInput">Confirm new password</Form.Label>
          <Form.Control id="confirmPasswordInput" type="password" value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)} />
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={changeDisabled} onClick={handleChange}>Change password</Button>
      </Modal.Footer>
    </Modal>
  );
}

function NavPageLinks() {
  const userContext = useContext(UserContext);
  const loggedInItemsHidden = useMemo(
    () => userContext.user === null || userContext.user === undefined,
    [userContext.user]
  );

  return (
    <Nav className="mr-auto">
      <LinkContainer to="/">
        <Nav.Link>Home</Nav.Link>
      </LinkContainer>
      <LinkContainer to="/all" hidden={loggedInItemsHidden}>
        <Nav.Link>My adventures</Nav.Link>
      </LinkContainer>
      <LinkContainer to="/shared" hidden={loggedInItemsHidden}>
        <Nav.Link>Shared with me</Nav.Link>
      </LinkContainer>
    </Nav>
  );
}

function NavLogin() {
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);
  const signInMethodsContext = useContext(SignInMethodsContext);
  const profile = useContext(ProfileContext);
  const statusContext = useContext(StatusContext);
  const analyticsContext = useContext(AnalyticsContext);

  const isPasswordUser = useMemo(
    () => signInMethodsContext.signInMethods.find(m => /password/i.test(m)) !== undefined,
    [signInMethodsContext.signInMethods]
  );

  const displayName = useMemo(
    () => profile?.name ?? userContext.user?.displayName ?? "",
    [profile, userContext.user]
  );

  const handleSignOut = useCallback(() => {
    firebaseContext.auth?.signOut()
      .catch(e => analyticsContext.logError("Error signing out: ", e));
  }, [firebaseContext.auth, analyticsContext]);
  
  const [showChangePassword, setShowChangePassword] = useState(false);

  // The profile editor:
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAnalyticsEnabled, setEditAnalyticsEnabled] = useState<boolean | undefined>(undefined);
  const analyticsIsEnabled = useMemo(() => editAnalyticsEnabled === true, [editAnalyticsEnabled]);

  const handleEditProfile = useCallback(() => {
    setShowChangePassword(false);
    setEditDisplayName(displayName);
    setEditAnalyticsEnabled(analyticsContext.enabled);
    setShowEditProfile(true);
  }, [analyticsContext, displayName, setEditAnalyticsEnabled, setEditDisplayName, setShowChangePassword, setShowEditProfile]);

  const handleModalClose = useCallback(() => {
    setShowChangePassword(false);
    setShowEditProfile(false);
  }, [setShowEditProfile]);

  const handleEditAnalyticsEnabledChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setEditAnalyticsEnabled(e.currentTarget.checked),
    [setEditAnalyticsEnabled]
  );

  const handleSaveProfile = useCallback(() => {
    handleModalClose();
    analyticsContext.setEnabled(editAnalyticsEnabled);
    if (userContext.dataService === undefined) {
      return;
    }

    // I don't need to ensureProfile() here: it was done by the login component
    updateProfile(userContext.dataService, userContext.user?.uid, editDisplayName)
      .then(() => console.log("successfully updated profile"))
      .catch(e => analyticsContext.logError("error updating profile:", e));
  }, [analyticsContext, editAnalyticsEnabled, editDisplayName, handleModalClose, userContext]);

  const saveProfileDisabled = useMemo(() => editDisplayName.length === 0, [editDisplayName]);

  const handleChangePassword = useCallback(() => {
    setShowChangePassword(true);
    setShowEditProfile(false);
  }, [setShowChangePassword, setShowEditProfile]);

  // We show a verified icon if the user's email is verified
  const verifiedIcon = useMemo(() => {
    if (userContext.user?.emailVerified === true) {
      return (
        <FontAwesomeIcon className="ml-1" icon={faCheck} color="white" />
      );
    } else {
      return undefined;
    }
  }, [userContext.user]);

  // We'll let users re-send their email verification once per login
  const [canResendEmailVerification, setCanResendEmailVerification] = useState(false);

  useEffect(() => {
    if (userContext.user?.emailVerified === false) {
      setCanResendEmailVerification(true);
    } else {
      setCanResendEmailVerification(false);
    }
  }, [userContext.user]);

  const handleResendEmailVerification = useCallback(() => {
    setCanResendEmailVerification(false);
    userContext.user?.sendEmailVerification()
      .then(() => statusContext.toasts.next({
        id: uuidv4(),
        record: { title: "Email/password login", message: "A verification email has been sent to " + userContext.user?.email }
      }))
      .catch(e => analyticsContext.logError("Resend email verification error", e));
  }, [analyticsContext, setCanResendEmailVerification, statusContext, userContext.user]);

  const resendVerificationItem = useMemo(() => {
    if (canResendEmailVerification === true) {
      return (
        <Dropdown.Item onClick={handleResendEmailVerification}>Re-send email verification</Dropdown.Item>
      );
    } else {
      return undefined;
    }
  }, [canResendEmailVerification, handleResendEmailVerification]);

  // We show the profile button as a dropdown only if there are further things to drop
  // down from it
  const profileButton = useMemo(() => {
    if (isPasswordUser) {
      return (
        <Dropdown alignRight>
          <Dropdown.Toggle variant="primary">
            {displayName}{verifiedIcon}
          </Dropdown.Toggle>
          <Dropdown.Menu>
            <Dropdown.Item onClick={handleEditProfile}>Edit profile</Dropdown.Item>
            <Dropdown.Item onClick={handleChangePassword}>Change password</Dropdown.Item>
            {resendVerificationItem}
          </Dropdown.Menu>
        </Dropdown>
      );
    } else {
      return (
        <Button variant="primary" onClick={handleEditProfile}>{displayName}{verifiedIcon}</Button>
      );
    }
  }, [displayName, handleChangePassword, handleEditProfile, isPasswordUser, resendVerificationItem, verifiedIcon]);

  const handleChangePasswordSave = useCallback((oldPassword: string, newPassword: string) => {
    handleModalClose();
    userContext.user?.changePassword(oldPassword, newPassword)
    .then(() => statusContext.toasts.next({
      id: uuidv4(),
      record: { title: "Password changed", message: "Password change was successful" }
    }))
    .catch(e => statusContext.toasts.next({
      id: uuidv4(),
      record: { title: "Password change failed", message: "Check your old password was entered correctly." }
    }));
  }, [handleModalClose, statusContext, userContext.user]);

  return userContext.user ? (
    <div>
      <Form inline>
        <ButtonGroup>
          {profileButton}
          <Button variant="outline-primary" onClick={handleSignOut}>Log out</Button>
        </ButtonGroup>
      </Form>
      <ChangePasswordModal shown={showChangePassword} handleClose={handleModalClose}
        handleChange={handleChangePasswordSave} />
      <Modal show={showEditProfile} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>User profile settings ({signInMethodsContext.signInMethods})</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label htmlFor="nameInput">Display name</Form.Label>
              <Form.Control id="nameInput" type="text" maxLength={30} value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)} />
              <Form.Text className="text-muted">
                This is the name that will be shown to other users of Wall &amp; Shadow.
              </Form.Text>
            </Form.Group>
            <Form.Group>
              <FormCheck inline>
                <FormCheck.Input id="allowAnalytics" type="checkbox" checked={analyticsIsEnabled}
                  onChange={handleEditAnalyticsEnabledChange} />
                <FormCheck.Label htmlFor="allowAnalytics">Allow Google Analytics</FormCheck.Label>
              </FormCheck>
              <Form.Text className="text-muted">
                Check this box to allow Wall &amp; Shadow to use Google Analytics to measure usage and identify errors, and accept the data collection and cookies required.
              </Form.Text>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
          <Button variant="primary" disabled={saveProfileDisabled} onClick={handleSaveProfile}>Save profile</Button>
        </Modal.Footer>
      </Modal>
    </div>
  ) : (
    <LinkContainer to="/login">
      <Nav.Link>Sign up/Login</Nav.Link>
    </LinkContainer>
  );
}

interface INavigationProps {
  children?: React.ReactNode | undefined;
}

function Navigation(props: INavigationProps) {
  const [expanded, setExpanded] = useState(false);
  const [width, setWidth] = useState<number | undefined>(undefined);

  // We don't want the children causing the nav bar to spill into extra lines, because those can
  // easily devour the available map space on a small screen:
  const childrenHidden = useMemo(
    () => expanded === false && width !== undefined && width < 700,
    [expanded, width]
  );

  return (
    <Measure bounds onResize={r => setWidth(r.bounds?.width)}>
      {({ measureRef }) => (
        <div ref={measureRef}>
          <Navbar bg="dark" expand="lg" variant="dark" sticky="top" onToggle={setExpanded}>
            <LinkContainer to="/">
              <Navbar.Brand className="App-brand">
                <img src="/32.png" alt="logo" />
                <div className="App-brand-text">
                  <div className="App-brand-main">
                    wall &amp; shadow
            </div>
                  <div className="App-brand-shadow">
                    wall &amp; shadow
            </div>
                </div>
              </Navbar.Brand>
            </LinkContainer>
            <Navbar.Collapse id="basic-navbar-nav">
              <NavPageLinks />
            </Navbar.Collapse>
            <Navbar.Text className="justify-content-centre" hidden={childrenHidden}>{props.children}</Navbar.Text>
            <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
              <NavLogin />
            </Navbar.Collapse>
            <Navbar.Toggle aria-controls="basic-navbar-nav" />
          </Navbar>
        </div>
      )}
    </Measure>
  );
}

export default Navigation;
