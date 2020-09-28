import React, { useCallback, useContext, useMemo, useState } from 'react';
import '../App.css';

import { AnalyticsContext } from './AnalyticsContextProvider';
import MapCards from './MapCards';
import MapEditorModal from './MapEditorModal';
import { StatusContext } from './StatusContextProvider';
import { UserContext } from './UserContextProvider';

import { IMapSummary } from '../data/adventure';
import { IMap } from '../data/map';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import { useHistory } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IMapCollectionProps {
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  showNewMap: boolean;
  deleteMap?: ((id: string) => void) | undefined
}

function MapCollection(props: IMapCollectionProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const statusContext = useContext(StatusContext);
  const userContext = useContext(UserContext);
  const history = useHistory();

  const [showDeleteMap, setShowDeleteMap] = useState(false);
  const [showEditMap, setShowEditMap] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("");

  const canDeleteMap = useMemo(() => props.deleteMap !== undefined, [props.deleteMap]);

  const handleNewMapClick = useCallback(() => {
    setShowEditMap(true);
  }, [setShowEditMap]);

  const handleDeleteMapClick = useCallback((m: IMapSummary) => {
    setEditId(m.id);
    setEditName(m.name);
    setShowDeleteMap(true);
  }, [setEditId, setEditName, setShowDeleteMap]);

  const handleModalClose = useCallback(() => {
    setEditId(undefined);
    setShowDeleteMap(false);
    setShowEditMap(false);
  }, [setEditId, setShowDeleteMap, setShowEditMap]);

  const handleNewMapSave = useCallback(async (adventureId: string, map: IMap) => {
    const functionsService = userContext.functionsService;
    if (functionsService === undefined) {
      return;
    }

    try {
      const id = await functionsService.createMap(adventureId, map.name, map.description, map.ty, map.ffa);
      history.replace('/adventure/' + adventureId + '/map/' + id);
    } catch (e) {
      handleModalClose();
      analyticsContext.logError('Failed to create map', e);
      const message = String(e.message);
      if (message) {
        statusContext.toasts.next({ id: uuidv4(), record: {
          title: "Error creating map", message: message
        }});
      }
    }
  }, [analyticsContext, handleModalClose, history, statusContext, userContext]);

  const handleDeleteMapSave = useCallback(() => {
    if (editId !== undefined) {
      props.deleteMap?.(editId);
    }

    handleModalClose();
  }, [editId, handleModalClose, props]);

  // The only adventures available for new maps are ones that we own
  const newMapAdventures = useMemo(
    () => props.adventures.filter(a => a.owner === userContext.user?.uid),
    [props.adventures, userContext]
  );

  return (
    <div>
      <MapCards showNewMapCard={props.showNewMap} createMap={handleNewMapClick}
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
          <Button variant="secondary" onClick={handleModalClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDeleteMapSave}>
            Yes, delete map!
            </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default MapCollection;