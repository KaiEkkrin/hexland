import React, { useCallback, useContext, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';

/*import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from "@material-ui/core";*/
import DecisionDialog from './DecisionDialog';

import { AnalyticsContext } from './AnalyticsContextProvider';
import MapCards from './MapCards';
import MapCloneModal from './MapCloneModal';
import MapEditorModal from './MapEditorModal';
import { StatusContext } from './StatusContextProvider';
import { UserContext } from './UserContextProvider';

import { IMapSummary } from '../data/adventure';
import { IMap } from '../data/map';
import { IAdventureSummary } from '../data/profile';

import { v4 as uuidv4 } from 'uuid';
import fluent from 'fluent-iterable';

interface IMapCollectionProps {
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  showNewMap: boolean;
  deleteMap?: ((id: string) => void) | undefined;
  pickImage?: ((map: IMapSummary) => void) | undefined;
}

function MapCollection({ adventures, maps, showNewMap, deleteMap, pickImage }: IMapCollectionProps) {
  const { logError } = useContext(AnalyticsContext);
  const { toasts } = useContext(StatusContext);
  const { functionsService, user } = useContext(UserContext);
  const history = useHistory();

  const [showCloneMap, setShowCloneMap] = useState(false);
  const [showDeleteMap, setShowDeleteMap] = useState(false);
  const [showEditMap, setShowEditMap] = useState(false);

  // Clone map state
  const cloneAdventure = useMemo(
    () => fluent(adventures).first(),
    [adventures]
  );
  const [cloneSourceMap, setCloneSourceMap] = useState<IMapSummary | undefined>(undefined);

  // Edit map state
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("");

  const canDeleteMap = useMemo(() => deleteMap !== undefined, [deleteMap]);

  const handleNewMapClick = useCallback(() => {
    setShowEditMap(true);
  }, [setShowEditMap]);

  const handleCloneMapClick = useCallback((m: IMapSummary) => {
    setCloneSourceMap(m);
    setShowCloneMap(true);
  }, [setCloneSourceMap, setShowCloneMap]);

  const handleDeleteMapClick = useCallback((m: IMapSummary) => {
    setEditId(m.id);
    setEditName(m.name);
    setShowDeleteMap(true);
  }, [setEditId, setEditName, setShowDeleteMap]);

  const handleModalClose = useCallback(() => {
    setEditId(undefined);
    setShowCloneMap(false);
    setShowDeleteMap(false);
    setShowEditMap(false);
  }, [setEditId, setShowCloneMap, setShowDeleteMap, setShowEditMap]);

  const handleNewMapSave = useCallback(async (adventureId: string, map: IMap) => {
    if (functionsService === undefined) {
      return;
    }

    try {
      const id = await functionsService.createMap(adventureId, map.name, map.description, map.ty, map.ffa);
      history.replace('/adventure/' + adventureId + '/map/' + id);
    } catch (e) {
      handleModalClose();
      logError('Failed to create map', e);
      const message = String(e.message);
      if (message) {
        toasts.next({ id: uuidv4(), record: {
          title: "Error creating map", message: message
        }});
      }
    }
  }, [logError, handleModalClose, history, toasts, functionsService]);

  const handleDeleteMapSave = useCallback(() => {
    if (editId !== undefined) {
      deleteMap?.(editId);
    }

    handleModalClose();
  }, [editId, handleModalClose, deleteMap]);

  // The only adventures available for new maps are ones that we own
  const newMapAdventures = useMemo(
    () => adventures.filter(a => a.owner === user?.uid),
    [adventures, user]
  );

      /*<Modal show={showDeleteMap} onHide={handleModalClose}>
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
      </Modal>*/

  return (
    <div>
      <MapCards showNewMapCard={showNewMap} createMap={handleNewMapClick}
        adventures={adventures} maps={maps}
        cloneMap={canDeleteMap ? handleCloneMapClick : undefined}
        deleteMap={canDeleteMap ? handleDeleteMapClick : undefined}
        pickImage={pickImage} />
      <MapCloneModal show={showCloneMap} adventure={cloneAdventure} sourceMap={cloneSourceMap}
        handleClose={handleModalClose} />
      <MapEditorModal show={showEditMap} adventures={newMapAdventures} map={undefined}
        handleClose={handleModalClose} handleSave={handleNewMapSave} />
      <DecisionDialog
        open={showDeleteMap}
        textAccept="Yes, delete map!"
        title="Delete map"
        onAccept={handleDeleteMapSave}
        onCancel={handleModalClose}
      >
        Do you really want to delete {editName}?
      </DecisionDialog>
    </div>
  );
}

export default MapCollection;