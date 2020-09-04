import React, { useContext, useMemo, useState } from 'react';
import '../App.css';

import { UserContext } from './UserContextProvider';
import MapCards from './MapCards';

import { IMapSummary } from '../data/adventure';
import { IMap } from '../data/map';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Modal from 'react-bootstrap/Modal';
import MapEditorModal from './MapEditorModal';

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
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  setMap?: ((adventureId: string, id: string | undefined, map: IMap) => void) | undefined,
  deleteMap?: ((id: string) => void) | undefined
}

function MapCollection(props: IMapCollectionProps) {
  const userContext = useContext(UserContext);
  const [showDeleteMap, setShowDeleteMap] = useState(false);
  const [showEditMap, setShowEditMap] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("");

  const canDeleteMap = useMemo(() => props.deleteMap !== undefined, [props.deleteMap]);

  function handleNewMapClick() {
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

  function handleNewMapSave(adventureId: string, map: IMap) {
    props.setMap?.(adventureId, undefined, map);
    handleModalClose();
  }

  function handleDeleteMapSave() {
    if (editId !== undefined) {
      props.deleteMap?.(editId);
    }

    handleModalClose();
  }

  // The only adventures available for new maps are ones that we own
  const newMapAdventures = useMemo(
    () => props.adventures.filter(a => a.owner === userContext.user?.uid),
    [props.adventures, userContext]
  );

  // Don't provide the new map card if no adventures would be selectable
  // or if we couldn't save
  const showNewMapCard = useMemo(
    () => newMapAdventures.length !== 0 && props.setMap !== undefined,
    [newMapAdventures, props.setMap]
  );

  return (
    <div>
      <MapCards newMapCard={<NewMap show={showNewMapCard} handleNewMapClick={handleNewMapClick} />}
        adventures={props.adventures} maps={props.maps}
        deleteMap={canDeleteMap ? handleDeleteMapClick : undefined} />
      <MapEditorModal show={showEditMap} adventures={newMapAdventures} map={undefined}
        handleClose={handleModalClose} handleSave={handleNewMapSave} />
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
            Yes, delete map!
            </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default MapCollection;