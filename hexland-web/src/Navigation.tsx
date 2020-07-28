import React from 'react';
import { auth } from './firebase';

import { AppContext, AppState } from './App';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

function Navigation() {
  return (
    <Navbar bg="dark" variant="dark" sticky="top">
      <Navbar.Brand href="/">hexland</Navbar.Brand>
      <Navbar.Collapse>
        <Nav className="mr-auto">
          <Nav.Link href="/">Home</Nav.Link>
          {
            // Temporarily, I'm adding Squares and Hexes explicitly.
            // Once I can start doing meaningful stuff with these, I want to
            // change to a model where I persist them and allow drop-down
            // selection of the different maps a user has created.
          }
          <Nav.Link href="/map/hex">Hexes</Nav.Link>
          <Nav.Link href="/map/square">Squares</Nav.Link>
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
                <Nav.Link href="/login">Login</Nav.Link>
              </Nav>
            </Navbar.Collapse >
          )}
      </AppContext.Consumer>
    </Navbar>
  );
}

export default Navigation;
