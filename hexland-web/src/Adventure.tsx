import React from 'react';
import './App.css';
import { auth, db } from './firebase';

import Navigation from './Navigation';

import { IAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { IMap, MapType } from './data/map';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

import { RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IMapCardsProps {
  maps: IIdentified<IMap>[];
  editMap: (id: string, map: IMap) => void;
  deleteMap: (id: string, map: IMap) => void;
}

function MapCards(props: IMapCardsProps) {
  return (
    <CardDeck>
      {props.maps.map((v) =>
        <Card key={v.id}>
          <Card.Body>
            <Card.Title>{v.record.name}</Card.Title>
            <Card.Subtitle className="text-muted">{v.record.ty as string} map</Card.Subtitle>
            <Card.Text>{v.record.description}</Card.Text>
          </Card.Body>
          <ButtonGroup>
            <Button variant="primary" onClick={() => props.editMap(v.id, v.record)}>Edit</Button>
            <Button variant="danger" onClick={() => props.deleteMap(v.id, v.record)}>Delete</Button>
          </ButtonGroup>
        </Card>
      )}
    </CardDeck>
  );
}

interface IAdventureProps {
  adventureId: string;
}

class AdventureState {
  adventureName: string | undefined;
  adventureDescription: string | undefined;
  maps: IIdentified<IMap>[] = [];
  editId: string | undefined = undefined;
  editName = "New map";
  editDescription = "";
  editType = MapType.Square;
  showEditMap = false;
  showDeleteMap = false;
}

class Adventure extends React.Component<RouteComponentProps<IAdventureProps>, AdventureState> {
  private _mapsChanged: firebase.Unsubscribe | undefined;

  constructor(props: RouteComponentProps<IAdventureProps>) {
    super(props);
    this.state = new AdventureState();

    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.handleNewMapClick = this.handleNewMapClick.bind(this);
    this.handleEditMapClick = this.handleEditMapClick.bind(this);
    this.handleDeleteMapClick = this.handleDeleteMapClick.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
    this.handleEditMapSave = this.handleEditMapSave.bind(this);
    this.handleDeleteMapSave = this.handleDeleteMapSave.bind(this);
  }

  private isModalSaveDisabled() {
    return this.state.editName.length === 0;
  }

  private handleNewMapClick() {
    this.setState({ editId: undefined, editName: "New map", editDescription: "", editType: MapType.Square, showEditMap: true });
  }

  private handleEditMapClick(id: string, map: IMap) {
    this.setState({ editId: id, editName: map.name, editDescription: map.description, editType: map.ty, showEditMap: true });
  }

  private handleDeleteMapClick(id: string, map: IMap) {
    this.setState({ editId: id, editName: map.name, showDeleteMap: true });
  }

  private handleModalClose() {
    this.setState({ editId: undefined, showEditMap: false, showDeleteMap: false });
  }

  private handleEditMapSave() {
    this.handleModalClose();

    var uid = auth.currentUser?.uid;
    if (uid === undefined) {
      return;
    }

    var id = this.state.editId ?? uuidv4(); // TODO learn about uuid versions, pick one least likely to clash :)
    db.collection("adventures").doc(this.props.match.params.adventureId).collection("maps").doc(id).set({
      name: this.state.editName,
      description: this.state.editDescription,
      ty: this.state.editType,
      owner: uid, // mismatches will result in an access control error, don't need to check here
    } as IMap)
    .then(() => {
      console.log("Map " + id + " successfully edited");
    })
    .catch((e) => {
      console.error("Error editing map: ", e);
    });
  }

  private handleDeleteMapSave() {
    this.handleModalClose();

    if (this.state.editId === undefined) {
      return;
    }

    var id = this.state.editId;
    db.collection("adventures").doc(this.props.match.params.adventureId).collection("maps").doc(id).delete()
      .then(() => {
        console.log("Map " + id + " successfully deleted");
      })
      .catch((e) => {
        console.error("Error deleting map: ", e);
      });
  }

  componentDidMount() {
    // I don't feel we need to worry too much about watching for changes to the adventure
    // details here
    db.collection("adventures").doc(this.props.match.params.adventureId).get()
      .then(d => {
        var data = d.data();
        if (data !== null) {
          var adventure = data as IAdventure;
          this.setState({ adventureName: adventure.name, adventureDescription: adventure.description });
        }
      })
      .catch(e => {
        console.error("Failed to fetch adventure", e);
      });

    // Watch for maps
    this._mapsChanged = db.collection("adventures").doc(this.props.match.params.adventureId)
      .collection("maps")
      .orderBy("name")
      .onSnapshot((s) => {
        var maps: IIdentified<IMap>[] = [];
        s.forEach((d) => {
          var data = d.data();
          if (data !== null) {
            var map = data as IMap;
            maps.push({ id: d.id, record: map });
          }
        });

        this.setState({ maps: maps });
      });
  }

  componentWillUnmount() {
    if (this._mapsChanged !== undefined) {
      this._mapsChanged();
      this._mapsChanged = undefined;
    }
  }

  render() {
    return (
      <div>
        <Navigation />
        <Container>
          {this.state.adventureName !== undefined && this.state.adventureDescription !== undefined ?
            <Row>
              <Col>
                <Card>
                  <Card.Body>
                    <Card.Title>{this.state.adventureName}</Card.Title>
                    <Card.Text>{this.state.adventureDescription}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            : <div></div>
          }
          <Row>
            <Col>
              <Button onClick={this.handleNewMapClick}>New map</Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <MapCards maps={this.state.maps} editMap={this.handleEditMapClick}
                deleteMap={this.handleDeleteMapClick} />
            </Col>
          </Row>
        </Container>
        <Modal show={this.state.showEditMap} onHide={this.handleModalClose}>
          <Modal.Header closeButton>
            <Modal.Title>Map</Modal.Title>
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
              <Form.Group>
                <Form.Label>Type</Form.Label>
                <Form.Control as="select" value={this.state.editType}
                  disabled={this.state.editId !== undefined}
                  onChange={e => this.setState({ editType: e.target.value as MapType })}>
                  <option>{MapType.Hex}</option>
                  <option>{MapType.Square}</option>
                </Form.Control>
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleModalClose}>Close</Button>
            <Button variant="primary" disabled={this.isModalSaveDisabled()}
              onClick={this.handleEditMapSave}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>
        <Modal show={this.state.showDeleteMap} onHide={this.handleModalClose}>
          <Modal.Header closeButton>
            <Modal.Title>Delete map</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <p>Do you really want to delete {this.state.editName}?</p>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleModalClose}>Close</Button>
            <Button variant="danger" onClick={this.handleDeleteMapSave}>
              Yes, delete!
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

export default Adventure;