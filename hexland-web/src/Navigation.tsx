import React from 'react';

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
      <Navbar.Collapse className="justify-content-end">
        { /* Some day, this will do something... */ }
        <Nav>
          <Nav.Link href="/login">Login</Nav.Link>
        </Nav>
      </Navbar.Collapse>
    </Navbar>
  );
}

export default Navigation;
