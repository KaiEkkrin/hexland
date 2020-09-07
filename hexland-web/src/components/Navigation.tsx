import React, { useContext, useMemo, useCallback, useState } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { ProfileContext } from './ProfileContextProvider';
import { UserContext } from './UserContextProvider';
import { updateProfile } from '../services/extensions';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { LinkContainer } from 'react-router-bootstrap';

interface INavigationProps {
  title: string | undefined;
}

function Navigation(props: INavigationProps) {
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);

  const displayName = useMemo(
    () => profile?.name ?? userContext.user?.displayName ?? "",
    [profile, userContext.user]
  );
  
  const loggedInItemsHidden = useMemo(
    () => userContext.user === null || userContext.user === undefined,
    [userContext.user]
  );

  const handleSignOut = useCallback(() => {
    firebaseContext.auth?.signOut()
      .catch(e => console.error("Error signing out: ", e));
  }, [firebaseContext.auth]);

  // The profile editor:
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [editDisplayName, setEditDisplayName] = useState("");

  const handleEditProfile = useCallback(() => {
    setEditDisplayName(displayName);
    setShowEditProfile(true);
  }, [displayName, setEditDisplayName, setShowEditProfile]);

  const handleModalClose = useCallback(() => setShowEditProfile(false), [setShowEditProfile]);

  const handleSaveProfile = useCallback(() => {
    handleModalClose();
    if (userContext.dataService === undefined) {
      return;
    }

    // I don't need to ensureProfile() here: it was done by the login component
    updateProfile(userContext.dataService, editDisplayName)
      .then(() => console.log("successfully updated profile"))
      .catch(e => console.error("error updating profile:", e));
  }, [editDisplayName, handleModalClose, userContext.dataService]);

  const saveProfileDisabled = useMemo(() => editDisplayName.length === 0, [editDisplayName]);

  return (
    <Navbar bg="dark" variant="dark" sticky="top">
      <LinkContainer to="/">
        <Navbar.Brand>hexland</Navbar.Brand>
      </LinkContainer>
      <Navbar.Collapse>
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
      </Navbar.Collapse>
      <Navbar.Collapse className="justify-content-center">
        <Navbar.Text className="mr-2">{props.title ?? ""}</Navbar.Text>
      </Navbar.Collapse>
      {userContext.user ? (
        <Navbar.Collapse className="justify-content-end">
          <Form inline>
            <ButtonGroup>
              <Button variant="primary" onClick={handleEditProfile}>{displayName}</Button>
              <Button variant="outline-primary" onClick={handleSignOut}>Log out</Button>
            </ButtonGroup>
          </Form>
        </Navbar.Collapse>
      ) : (
          <Navbar.Collapse className="justify-content-end">
            <Nav>
              <LinkContainer to="/login">
                <Nav.Link>Login</Nav.Link>
              </LinkContainer>
            </Nav>
          </Navbar.Collapse >
        )}
      <Modal show={showEditProfile}>
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
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
          <Button variant="primary" disabled={saveProfileDisabled} onClick={handleSaveProfile}>Save profile</Button>
        </Modal.Footer>
      </Modal>
    </Navbar>
  );
}

export default Navigation;
