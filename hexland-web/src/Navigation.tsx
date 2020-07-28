import React from 'react';
import { auth } from './firebase';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';

interface IUserNavProps {
  user: firebase.User | null;
}

function UserNav(props: IUserNavProps) {
  if (props.user !== null) {
    return (
      <Navbar.Collapse className="justify-content-end">
        <Navbar.Text className="mr-2">
          {props.user.displayName}
        </Navbar.Text>
        <Form inline>
          <Button variant="outline-primary" onClick={() => auth.signOut()}>Log out</Button>
        </Form>
      </Navbar.Collapse >
    );
  } else {
    return (
      <Navbar.Collapse className="justify-content-end">
        <Nav>
          <Nav.Link href="/login">Login</Nav.Link>
        </Nav>
      </Navbar.Collapse >
    );
  }
}

interface INavigationProps {}

class NavigationState {
  user: firebase.User | null = null;
}

class Navigation extends React.Component<INavigationProps, NavigationState> {
  constructor(props: INavigationProps) {
    super(props);
    this.state = new NavigationState();
  }

  componentDidMount() {
    auth.onAuthStateChanged(u => {
      this.setState({ user: u });
    });
  }

  render() {
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
        <UserNav user={this.state.user} />
      </Navbar>
    );
  }
}

export default Navigation;
