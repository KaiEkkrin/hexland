import React from 'react';
import './App.css';
import { auth, db } from './firebase';
import Navigation from './Navigation';

import { IAdventure } from './data/adventure';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';

interface IAdventureCardsProps {
  adventures: IAdventure[];
}

function AdventureCards(props: IAdventureCardsProps) {
  return (
    <CardDeck>
      {props.adventures.map((a) =>
        <Card>
          <Card.Body>
            <Card.Title>{a.name}</Card.Title>
            <Card.Text>{a.description}</Card.Text>
          </Card.Body>
        </Card>
      )}
    </CardDeck>
  );
}

interface IHomeProps {}

class HomeState {
  adventures: IAdventure[] = [];
  newName = "New adventure";
  newDescription = "";
  showNewAdventure = false;
}

class Home extends React.Component<IHomeProps, HomeState> {
  private _authStateChanged: firebase.Unsubscribe | undefined;
  private _adventuresChanged: firebase.Unsubscribe | undefined;

  constructor(props: IHomeProps) {
    super(props);
    this.state = new HomeState();

    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.handleNewAdventureClick = this.handleNewAdventureClick.bind(this);
    this.handleNewAdventureClose = this.handleNewAdventureClose.bind(this);
    this.handleNewAdventureSave = this.handleNewAdventureSave.bind(this);
  }

  private isModalSaveDisabled() {
    return this.state.newName.length === 0;
  }

  private handleNewAdventureClick() {
    this.setState({ showNewAdventure: true });
  }

  private handleNewAdventureClose() {
    this.setState({ showNewAdventure: false });
  }

  private handleNewAdventureSave() {
    this.handleNewAdventureClose();

    var uid = auth.currentUser?.uid;
    if (uid === undefined) {
      return;
    }

    var id = uuidv4(); // TODO learn about uuid versions, pick one least likely to clash :)
    db.collection("adventures").doc(id).set({
      name: this.state.newName,
      description: this.state.newDescription,
      owner: uid,
    } as IAdventure)
    .then(() => {
      console.log("Adventure " + id + " successfully created");
    })
    .catch((e) => {
      console.error("Error creating adventure: ", e);
    });
  }

  componentDidMount() {
    this._authStateChanged = auth.onAuthStateChanged(u => {
      if (this._adventuresChanged !== undefined) {
        this._adventuresChanged();
        this._adventuresChanged = undefined;
      }

      // watch for maps :)
      if (u === null) {
        return;
      }

      this._adventuresChanged = db.collection("adventures").where("owner", "==", u.uid)
        .orderBy("name")
        .onSnapshot((s) => {
          var adventures: IAdventure[] = [];
          s.forEach((d) => {
            var data = d.data();
            if (data !== null) {
              var adventure = data as IAdventure;
              adventures.push(adventure);
            }
          });

          this.setState({ adventures: adventures });
        })
    });
  }

  componentWillUnmount() {
    if (this._authStateChanged !== undefined) {
      this._authStateChanged();
      this._authStateChanged = undefined;
    }

    if (this._adventuresChanged !== undefined) {
      this._adventuresChanged();
      this._adventuresChanged = undefined;
    }
  }

  render() {
    if (auth.currentUser === null) {
      return (
        <div>
          <Navigation />
          <header className="App-header">
            <p>Log in to create or join an adventure.</p>
          </header>
        </div>
      );
    }

    return (
      <div>
        <Navigation />
        <Container fluid>
          <Row>
            <Col>
              <Button onClick={this.handleNewAdventureClick}>New adventure</Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <AdventureCards adventures={this.state.adventures} />
            </Col>
          </Row>
        </Container>
        <Modal show={this.state.showNewAdventure} onHide={this.handleNewAdventureClose}>
          <Modal.Header closeButton>
            <Modal.Title>New adventure</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control type="text" maxLength={30} value={this.state.newName}
                  onChange={e => this.setState({ newName: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={5} maxLength={300} value={this.state.newDescription}
                  onChange={e => this.setState({ newDescription: e.target.value })} />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleNewAdventureClose}>Close</Button>
            <Button variant="primary" disabled={this.isModalSaveDisabled()}
              onClick={this.handleNewAdventureSave}>
              Create
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Home;
