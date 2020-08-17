import React, { useContext, useMemo } from 'react';

import { FirebaseContext } from './FirebaseContextProvider';
import { ProfileContext } from './ProfileContextProvider';
import { UserContext } from './UserContextProvider';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
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
  
  const loggedInItemsHidden = useMemo(
    () => userContext.user === null || userContext.user === undefined,
    [userContext.user]
  );

  function handleSignOut() {
    firebaseContext.auth?.signOut()
      .catch(e => console.error("Error signing out: ", e));
  }

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
          <Navbar.Text className="mr-2">
            {profile?.name}
          </Navbar.Text>
          <Form inline>
            <Button variant="outline-primary" onClick={handleSignOut}>Log out</Button>
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
    </Navbar>
  );
}

export default Navigation;
