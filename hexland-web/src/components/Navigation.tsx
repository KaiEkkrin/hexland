import React, { useContext, useMemo, useCallback, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { FirebaseContext } from './FirebaseContextProvider';
import { ProfileContext } from './ProfileContextProvider';
import { UserContext } from './UserContextProvider';
import { updateProfile } from '../services/extensions';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import FormCheck from 'react-bootstrap/FormCheck';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { LinkContainer } from 'react-router-bootstrap';

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
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);

  const displayName = useMemo(
    () => profile?.name ?? userContext.user?.displayName ?? "",
    [profile, userContext.user]
  );

  const handleSignOut = useCallback(() => {
    firebaseContext.auth?.signOut()
      .catch(e => analyticsContext.logError("Error signing out: ", e));
  }, [firebaseContext.auth, analyticsContext]);

  // The profile editor:
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editAnalyticsEnabled, setEditAnalyticsEnabled] = useState(false);

  const handleEditProfile = useCallback(() => {
    setEditDisplayName(displayName);
    setEditAnalyticsEnabled(analyticsContext.enabled);
    setShowEditProfile(true);
  }, [analyticsContext, displayName, setEditDisplayName, setShowEditProfile]);

  const handleModalClose = useCallback(() => setShowEditProfile(false), [setShowEditProfile]);

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

  return userContext.user ? (
    <div>
      <Form inline>
        <ButtonGroup>
          <Button variant="primary" onClick={handleEditProfile}>{displayName}</Button>
          <Button variant="outline-primary" onClick={handleSignOut}>Log out</Button>
        </ButtonGroup>
      </Form>
      <Modal show={showEditProfile} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>User profile settings</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label htmlFor="nameInput">Display name</Form.Label>
              <Form.Control id="nameInput" type="text" maxLength={30} value={editDisplayName}
                onChange={e => setEditDisplayName(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <FormCheck inline>
                <FormCheck.Input id="allowAnalytics" type="checkbox" checked={editAnalyticsEnabled}
                  onChange={handleEditAnalyticsEnabledChange} />
                <FormCheck.Label htmlFor="allowAnalytics">Allow Google Analytics</FormCheck.Label>
              </FormCheck>
              <Form.Text className="text-muted">
                Check this box to allow Hexland to use Google Analytics to measure usage and identify errors, and accept the data collection and cookies required.
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
  title: string | undefined;
}

function Navigation(props: INavigationProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Navbar bg="dark" expand="md" variant="dark" sticky="top" onToggle={setExpanded}>
      <LinkContainer to="/">
        <Navbar.Brand>hexland</Navbar.Brand>
      </LinkContainer>
      <Navbar.Toggle aria-controls="basic-navbar-nav" />
      <Navbar.Collapse id="basic-navbar-nav">
        <NavPageLinks />
      </Navbar.Collapse>
      <Navbar.Collapse id="basic-navbar-nav" className="justify-content-center" hidden={expanded}>
        <Navbar.Text className="mr-2">{props.title ?? ""}</Navbar.Text>
      </Navbar.Collapse>
      <Navbar.Collapse id="basic-navbar-nav" className="justify-content-end">
        <NavLogin />
      </Navbar.Collapse>
    </Navbar>
  );
}

export default Navigation;
