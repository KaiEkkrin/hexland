import React from 'react';
import './App.css';

import { AppContext, AppState } from './App';
import MapCards from './MapCards';
import Navigation from './Navigation';

import { IAdventure, IMapSummary } from './data/adventure';
import { MapType } from './data/map';
import { IProfile } from './data/profile';
import { propagateMapDelete, propagateMapEdit } from './services/extensions';
import { IDataService } from './services/interfaces';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

import { RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IAdventureProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
  adventureId: string;
}

class AdventureState {
  adventure: IAdventure | undefined = undefined;
  editId: string | undefined = undefined;
  editName = "New map";
  editDescription = "";
  editType = MapType.Square;
  showEditMap = false;
  showDeleteMap = false;
}

class Adventure extends React.Component<IAdventureProps, AdventureState> {
  private _stopWatchingAdventure: (() => void) | undefined;

  constructor(props: IAdventureProps) {
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

  private handleEditMapClick(m: IMapSummary) {
    this.setState({ editId: m.id, editName: m.name, editDescription: m.description, editType: m.ty, showEditMap: true });
  }

  private handleDeleteMapClick(m: IMapSummary) {
    this.setState({ editId: m.id, editName: m.name, showDeleteMap: true });
  }

  private handleModalClose() {
    this.setState({ editId: undefined, showEditMap: false, showDeleteMap: false });
  }

  private handleEditMapSave() {
    this.handleModalClose();

    var uid = this.props.dataService?.getUid();
    if (uid === undefined || this.state.adventure === undefined) {
      return;
    }

    var id = this.state.editId ?? uuidv4(); // TODO learn about uuid versions, pick one least likely to clash :)
    var updated = this.state.adventure.maps.find(m => m.id === id);
    if (updated !== undefined) {
      // Can't edit the other fields
      updated.name = this.state.editName;
      updated.description = this.state.editDescription;
    } else {
      updated = {
        id: id,
        name: this.state.editName,
        description: this.state.editDescription,
        ty: this.state.editType
      } as IMapSummary;
      this.state.adventure.maps.push(updated);
    }

    this.props.dataService?.setAdventure(this.props.adventureId, this.state.adventure)
      .then(() => console.log("Adventure " + this.props.adventureId + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + this.props.adventureId, e));

    propagateMapEdit(this.props.dataService, this.props.profile, updated)
      .then(() => console.log("Propagated map edit " + id))
      .catch(e => console.error("Error propagating map edit " + id, e));
  }

  private handleDeleteMapSave() {
    this.handleModalClose();

    if (this.state.editId === undefined || this.state.adventure === undefined) {
      return;
    }

    var index = this.state.adventure.maps.findIndex(m => m.id === this.state.editId);
    if (index < 0) {
      return;
    }

    var updated = {
      name: this.state.adventure.name,
      description: this.state.adventure.description,
      owner: this.state.adventure.owner,
      maps: this.state.adventure.maps.filter(m => m.id !== this.state.editId)
    } as IAdventure;

    this.props.dataService?.setAdventure(this.props.adventureId, updated)
      .then(() => console.log("Adventure " + this.props.adventureId + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + this.props.adventureId, e));

    propagateMapDelete(this.props.dataService, this.props.profile, this.state.editId)
      .then(() => console.log("Propagated map delete " + this.state.editId))
      .catch(e => console.error("Error propagating map delete " + this.state.editId, e));
  }

  private watchAdventure() {
    this._stopWatchingAdventure?.();
    this._stopWatchingAdventure = this.props.dataService?.watchAdventure(
      this.props.adventureId,
      a => this.setState({ adventure: a }),
      e => console.error("Error watching adventure " + this.props.adventureId + ":", e)
    );
  }

  componentDidMount() {
    this.watchAdventure();
  }

  componentDidUpdate(prevProps: IAdventureProps) {
    if (this.props.dataService !== prevProps.dataService || this.props.adventureId !== prevProps.adventureId) {
      this.watchAdventure();
    }
  }

  componentWillUnmount() {
    this._stopWatchingAdventure?.();
    this._stopWatchingAdventure = undefined;
  }

  render() {
    return (
      <div>
        <Navigation />
        <Container>
          {this.state.adventure !== undefined ?
            <Row>
              <Col>
                <Card>
                  <Card.Body>
                    <Card.Title>{this.state.adventure.name}</Card.Title>
                    <Card.Text>{this.state.adventure.description}</Card.Text>
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
              <MapCards maps={this.state.adventure?.maps ?? []} editMap={this.handleEditMapClick}
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

interface IAdventurePageProps {
  adventureId: string;
}

function AdventurePage(props: RouteComponentProps<IAdventurePageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <Adventure dataService={context.dataService} profile={context.profile}
          adventureId={props.match.params.adventureId} />
      )}
    </AppContext.Consumer>
  )
}

export default AdventurePage;