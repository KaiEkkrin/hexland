import React from 'react';
import './App.css';

import MapCards from './MapCards';

import { IMapSummary } from './data/adventure';
import { MapType } from './data/map';
import { IAdventureSummary } from './data/profile';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

interface IMapCollectionProps {
  editable: boolean,
  showAdventureSelection: boolean,
  getAdventures: () => IAdventureSummary[];
  getMaps: () => IMapSummary[];
  setMap: ((adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) => void) | undefined;
  deleteMap: ((id: string) => void) | undefined;
}

class MapCollectionState {
  editAdventureId: string | undefined = undefined;
  editId: string | undefined = undefined;
  editName = "New map";
  editDescription = "";
  editType = MapType.Square;
  showEditMap = false;
  showDeleteMap = false;
}

class MapCollection extends React.Component<IMapCollectionProps, MapCollectionState> {
  constructor(props: IMapCollectionProps) {
    super(props);
    this.state = new MapCollectionState();

    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.handleNewMapClick = this.handleNewMapClick.bind(this);
    this.handleEditMapClick = this.handleEditMapClick.bind(this);
    this.handleDeleteMapClick = this.handleDeleteMapClick.bind(this);
    this.handleEditMapSave = this.handleEditMapSave.bind(this);
    this.handleDeleteMapSave = this.handleDeleteMapSave.bind(this);
    this.handleModalClose = this.handleModalClose.bind(this);
  }

  private getFirstAdventureId(): string | undefined {
    var adventures = this.props.getAdventures();
    return adventures.length > 0 ? adventures[0].id : undefined;
  }

  private isModalSaveDisabled() {
    return this.state.editAdventureId === undefined || this.state.editName.length === 0;
  }

  private handleNewMapClick() {
    this.setState({
      editAdventureId: this.getFirstAdventureId(),
      editId: undefined,
      editName: "New map",
      editDescription: "",
      editType: MapType.Square,
      showEditMap: true
    });
  }

  private handleEditMapClick(m: IMapSummary) {
    this.setState({
      editAdventureId: this.getFirstAdventureId(), // we presume!
      editId: m.id,
      editName: m.name,
      editDescription: m.description,
      editType: m.ty,
      showEditMap: true
    });
  }

  private handleDeleteMapClick(m: IMapSummary) {
    this.setState({ editId: m.id, editName: m.name, showDeleteMap: true });
  }

  private handleEditMapSave() {
    if (this.state.editAdventureId === undefined) {
      return;
    }

    this.props.setMap?.(
      this.state.editAdventureId,
      this.state.editId,
      this.state.editName,
      this.state.editDescription,
      this.state.editType
    );
    this.handleModalClose();
  }

  private handleDeleteMapSave() {
    if (this.state.editId !== undefined) {
      this.props.deleteMap?.(this.state.editId);
    }

    this.handleModalClose();
  }

  private handleModalClose() {
    this.setState({ editId: undefined, showEditMap: false, showDeleteMap: false });
  }

  render() {
    return (
      <div>
        <Row className="mt-4">
          <Col>
            <Button onClick={this.handleNewMapClick}>New map</Button>
          </Col>
        </Row>
        <Row className="mt-4">
          <Col>
            <MapCards editable={this.props.editable} maps={this.props.getMaps()}
              editMap={this.handleEditMapClick}
              deleteMap={this.handleDeleteMapClick} />
          </Col>
        </Row>
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
              {(this.props.showAdventureSelection === false) ? <div></div> :
                <Form.Group>
                  <Form.Label>Adventure</Form.Label>
                  <Form.Control as="select" value={this.state.editAdventureId}
                    onChange={e => this.setState({ editAdventureId: e.target.value })}>
                    {this.props.getAdventures().map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Form.Control>
                </Form.Group>
              }
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

export default MapCollection;