import React, { useCallback, useEffect, useState, useContext, useMemo } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import { UserContext } from './UserContextProvider';

import { IMapSummary } from '../data/adventure';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import { useHistory } from 'react-router-dom';

// The map clone modal is like the map editor modal but intentionally more limited.
// We only expect to be integrated into the adventure page, so we don't need to
// provide things like an adventure selection (for now).

interface IMapCloneModalProps {
  show: boolean;
  adventure: IAdventureSummary | undefined;
  sourceMap: IMapSummary | undefined;
  handleClose: () => void; // not called if we clone and redirect
}

function MapCloneModal(props: IMapCloneModalProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const history = useHistory();

  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (props.show === true) {
      setIsSaving(false);
    }
  }, [props.show, setIsSaving]);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const isSaveDisabled = useMemo(
    () => name.length === 0 || description.length === 0 || name === props.sourceMap?.name,
    [description, name, props.sourceMap]
  );

  const saveText = useMemo(() => isSaving ? "Cloning..." : "Clone map", [isSaving]);

  useEffect(() => {
    setName(props.sourceMap?.name ?? "");
    setDescription(props.sourceMap?.description ?? "");
    setIsSaving(false);
  }, [props.sourceMap, setDescription, setIsSaving, setName]);

  const handleSave = useCallback(() => {
    if (
      userContext.functionsService === undefined ||
      props.adventure === undefined ||
      props.sourceMap === undefined
    ) {
      return;
    }

    setIsSaving(true);
    userContext.functionsService.cloneMap(props.adventure.id, props.sourceMap.id, name, description)
      .then(mapId => history.replace('/adventure/' + props.adventure?.id + '/map/' + mapId))
      .catch(e => {
        props.handleClose();
        setIsSaving(false);
        analyticsContext.logError("Failed to clone map " + props.sourceMap?.name, e);
      });
  }, [analyticsContext, description, history, name, props, setIsSaving, userContext]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Clone map {props.sourceMap?.name}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="mapNameInput">Map name</Form.Label>
            <Form.Control id="mapNameInput" type="text" maxLength={30} value={name}
              onChange={e => setName(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="mapDescriptionInput">Map description</Form.Label>
            <Form.Control id="mapDescriptionInput" as="textarea" rows={5} maxLength={300}
              value={description} onChange={e => setDescription(e.target.value)} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button disabled={isSaveDisabled} variant="primary" onClick={handleSave}>{saveText}</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MapCloneModal;