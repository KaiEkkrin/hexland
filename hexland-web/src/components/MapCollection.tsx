import React, { useMemo, useState } from 'react';
import '../App.css';

import MapCards from './MapCards';

import { IMapSummary } from '../data/adventure';
import { MapType } from '../data/map';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

interface INewMapProps {
  show: boolean;
  handleNewMapClick: () => void;
}

function NewMap(props: INewMapProps) {
  if (props.show === false) {
    return null;
  }

  return (
    <Card className="mt-4" style={{ minWidth: '16rem', maxWidth: '16rem' }}
      bg="dark" text="white" key="new">
      <Card.Body>
        <Button onClick={props.handleNewMapClick}>New map</Button>
      </Card.Body>
    </Card>
  );
}

interface IMapCollectionProps {
  editable: boolean,
  showAdventureSelection: boolean,
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  setMap: ((adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) => void) | undefined;
  deleteMap: ((id: string) => void) | undefined;
}

function MapCollection(props: IMapCollectionProps) {
  const firstAdventureId = useMemo(
    () => props.adventures.length > 0 ? props.adventures[0].id : undefined,
    [props.adventures]
  );

  const [editAdventureId, setEditAdventureId] = useState<string | undefined>(firstAdventureId);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("New map");
  const [editDescription, setEditDescription] = useState("");
  const [editType, setEditType] = useState(MapType.Square);
  const [showDeleteMap, setShowDeleteMap] = useState(false);
  const [showEditMap, setShowEditMap] = useState(false);

  const isModalSaveDisabled = useMemo(
    () => editAdventureId === undefined || editName.length === 0,
    [editAdventureId, editName]
  );

  function handleNewMapClick() {
    setEditAdventureId(firstAdventureId);
    setEditId(undefined);
    setEditName("New map");
    setEditDescription("");
    setEditType(MapType.Square);
    setShowEditMap(true);
  }

  function handleEditMapClick(m: IMapSummary) {
    setEditAdventureId(m.adventureId); // TODO #30 do I need to fetch all adventures to stop messing this up?
                                       // Really I shouldn't allow you to change this at all, when the map
                                       // already exists!
    setEditId(m.id);
    setEditName(m.name);
    setEditDescription(m.description);
    setEditType(m.ty);
    setShowEditMap(true);
  }

  function handleDeleteMapClick(m: IMapSummary) {
    setEditId(m.id);
    setEditName(m.name);
    setShowDeleteMap(true);
  }

  function handleModalClose() {
    setEditId(undefined);
    setShowDeleteMap(false);
    setShowEditMap(false);
  }

  function handleEditMapSave() {
    if (editAdventureId !== undefined) {
      props.setMap?.(
        editAdventureId,
        editId,
        editName,
        editDescription,
        editType
      );
    }

    handleModalClose();
  }

  function handleDeleteMapSave() {
    if (editId !== undefined) {
      props.deleteMap?.(editId);
    }

    handleModalClose();
  }

  // Don't provide the new map card if no adventures would be selectable
  const showNewMapCard = useMemo(
    () => props.showAdventureSelection !== true || props.adventures.length !== 0,
    [props.showAdventureSelection, props.adventures]
  );

  return (
    <div>
      <MapCards newMapCard={<NewMap show={showNewMapCard} handleNewMapClick={handleNewMapClick} />}
        editable={props.editable} maps={props.maps}
        editMap={handleEditMapClick}
        deleteMap={handleDeleteMapClick} />
      <Modal show={showEditMap} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group>
              <Form.Label>Name</Form.Label>
              <Form.Control type="text" maxLength={30} value={editName}
                onChange={e => setEditName(e.target.value)} />
            </Form.Group>
            {(props.showAdventureSelection !== true) ? <div></div> :
              <Form.Group>
                <Form.Label>Adventure</Form.Label>
                <Form.Control as="select" value={editAdventureId}
                  onChange={e => setEditAdventureId(e.target.value)}>
                  {props.adventures.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </Form.Control>
              </Form.Group>
            }
            <Form.Group>
              <Form.Label>Description</Form.Label>
              <Form.Control as="textarea" rows={5} maxLength={300} value={editDescription}
                onChange={e => setEditDescription(e.target.value)} />
            </Form.Group>
            <Form.Group>
              <Form.Label>Type</Form.Label>
              <Form.Control as="select" value={editType}
                disabled={editId !== undefined}
                onChange={e => setEditType(e.target.value as MapType)}>
                <option>{MapType.Hex}</option>
                <option>{MapType.Square}</option>
              </Form.Control>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
          <Button variant="primary" disabled={isModalSaveDisabled}
            onClick={handleEditMapSave}>
            Save
            </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showDeleteMap} onHide={handleModalClose}>
        <Modal.Header closeButton>
          <Modal.Title>Delete map</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Do you really want to delete {editName}?</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
          <Button variant="danger" onClick={handleDeleteMapSave}>
            Yes, delete!
            </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default MapCollection;