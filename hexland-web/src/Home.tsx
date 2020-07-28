import React from 'react';
import './App.css';
import { auth, db } from './firebase';
import Navigation from './Navigation';

import { IAdventure } from './data/adventure';
import { IIdentified } from './data/identified';

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
  adventures: IIdentified<IAdventure>[];
  editAdventure: (id: string, adventure: IAdventure) => void;
}

function AdventureCards(props: IAdventureCardsProps) {
  return (
    <CardDeck>
      {props.adventures.map((v) =>
        <Card key={v.id}>
          <Card.Body>
            <Card.Title>{v.record.name}</Card.Title>
            <Card.Text>{v.record.description}</Card.Text>
            <Card.Link href={"/adventure/" + v.id}>Open</Card.Link>
          </Card.Body>
          <Button variant="primary" onClick={() => props.editAdventure(v.id, v.record)}>Edit</Button>
        </Card>
      )}
    </CardDeck>
  );
}

interface IHomeProps {}

class HomeState {
  adventures: IIdentified<IAdventure>[] = [];
  editId: string | undefined = undefined;
  editName = "New adventure";
  editDescription = "";
  showEditAdventure = false;
}

class Home extends React.Component<IHomeProps, HomeState> {
  private _authStateChanged: firebase.Unsubscribe | undefined;
  private _adventuresChanged: firebase.Unsubscribe | undefined;

  constructor(props: IHomeProps) {
    super(props);
    this.state = new HomeState();

    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.handleNewAdventureClick = this.handleNewAdventureClick.bind(this);
    this.handleEditAdventureClick = this.handleEditAdventureClick.bind(this);
    this.handleEditAdventureClose = this.handleEditAdventureClose.bind(this);
    this.handleEditAdventureSave = this.handleEditAdventureSave.bind(this);
  }

  private isModalSaveDisabled() {
    return this.state.editName.length === 0;
  }

  private handleNewAdventureClick() {
    this.setState({ editId: undefined, editName: "New adventure", editDescription: "", showEditAdventure: true });
  }

  private handleEditAdventureClick(id: string, adventure: IAdventure) {
    this.setState({ editId: id, editName: adventure.name, editDescription: adventure.description, showEditAdventure: true });
  }

  private handleEditAdventureClose() {
    this.setState({ showEditAdventure: false });
  }

  private handleEditAdventureSave() {
    this.handleEditAdventureClose();

    var uid = auth.currentUser?.uid;
    if (uid === undefined) {
      return;
    }

    var id = this.state.editId ?? uuidv4(); // TODO learn about uuid versions, pick one least likely to clash :)
    db.collection("adventures").doc(id).set({
      name: this.state.editName,
      description: this.state.editDescription,
      owner: uid, // mismatches will result in an access control error, don't need to check here
    } as IAdventure)
    .then(() => {
      console.log("Adventure " + id + " successfully edited");
    })
    .catch((e) => {
      console.error("Error editing adventure: ", e);
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
          var adventures: IIdentified<IAdventure>[] = [];
          s.forEach((d) => {
            var data = d.data();
            if (data !== null) {
              var adventure = data as IAdventure;
              adventures.push({ id: d.id, record: adventure });
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
        <Container>
          <Row>
            <Col>
              <Button onClick={this.handleNewAdventureClick}>New adventure</Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <AdventureCards adventures={this.state.adventures} editAdventure={this.handleEditAdventureClick} />
            </Col>
          </Row>
        </Container>
        <Modal show={this.state.showEditAdventure} onHide={this.handleEditAdventureClose}>
          <Modal.Header closeButton>
            <Modal.Title>New adventure</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control type="text" maxLength={30} value={this.state.editName}
                  onChange={e => this.setState({ editName: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={5} maxLength={300} value={this.state.editDescription}
                  onChange={e => this.setState({ editDescription: e.target.value })} />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleEditAdventureClose}>Close</Button>
            <Button variant="primary" disabled={this.isModalSaveDisabled()}
              onClick={this.handleEditAdventureSave}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Home;
