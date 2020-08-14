import React, { useContext } from 'react';

import { UserContext, FirebaseContext } from '../App';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { LinkContainer } from 'react-router-bootstrap';

interface INavigationProps {
  title: string | undefined;
}

function Navigation(props: INavigationProps) {
  var firebaseContext = useContext(FirebaseContext);
  var userContext = useContext(UserContext);
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
          {userContext.user === null ? <div></div> :
            <LinkContainer to="/all">
              <Nav.Link>My adventures</Nav.Link>
            </LinkContainer>
          }
          {userContext.user === null ? <div></div> :
            <LinkContainer to="/shared">
              <Nav.Link>Shared with me</Nav.Link>
            </LinkContainer>
          }
        </Nav>
      </Navbar.Collapse>
      <Navbar.Collapse className="justify-content-center">
        <Navbar.Text className="mr-2">{props.title ?? ""}</Navbar.Text>
      </Navbar.Collapse>
      {userContext.user !== null && userContext.user !== undefined ? (
        <Navbar.Collapse className="justify-content-end">
          <Navbar.Text className="mr-2">
            {userContext.user.displayName}
          </Navbar.Text>
          <Form inline>
            <Button variant="outline-primary" onClick={() => firebaseContext.auth?.signOut()}>Log out</Button>
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
