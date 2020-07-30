import React from 'react';
import { auth } from './firebase';

import { AppContext, AppState } from './App';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import { LinkContainer } from 'react-router-bootstrap';

function Navigation() {
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
          <LinkContainer to="/all">
            <Nav.Link>All</Nav.Link>
          </LinkContainer>
        </Nav>
      </Navbar.Collapse>
      <AppContext.Consumer>
        {(context: AppState) => context.user !== null ? (
          <Navbar.Collapse className="justify-content-end">
            <Navbar.Text className="mr-2">
              {context.user.displayName}
            </Navbar.Text>
            <Form inline>
              <Button variant="outline-primary" onClick={() => auth.signOut()}>Log out</Button>
            </Form>
          </Navbar.Collapse >
        ) : (
            <Navbar.Collapse className="justify-content-end">
              <Nav>
                <LinkContainer to="/login">
                  <Nav.Link>Login</Nav.Link>
                </LinkContainer>
              </Nav>
            </Navbar.Collapse >
          )}
      </AppContext.Consumer>
    </Navbar>
  );
}

export default Navigation;
