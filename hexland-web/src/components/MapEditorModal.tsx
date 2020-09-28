import React, { useCallback, useEffect, useState, useContext, useMemo } from 'react';

import { UserContext } from './UserContextProvider';
import { IAdventureIdentified } from '../data/identified';
import { IMap, MapType } from '../data/map';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import fluent from 'fluent-iterable';

// TODO #23 Support new map in this modal too, and copy in the remaining fields
// from the modal in MapCollection.tsx (and delete that one)
interface IMapEditorModalProps {
  show: boolean;
  adventures?: IAdventureSummary[] | undefined; // for new map only
  map: IAdventureIdentified<IMap> | undefined; // undefined to create a new map
  handleClose: () => void;
  handleSave: (adventureId: string, updated: IMap) => Promise<void>;
}

function MapEditorModal(props: IMapEditorModalProps) {
  const userContext = useContext(UserContext);

  const [isSaving, setIsSaving] = useState(false);
  useEffect(() => {
    if (props.show === true) {
      setIsSaving(false);
    }
  }, [props.show, setIsSaving]);

  const [name, setName] = useState("");
  const [adventureId, setAdventureId] = useState<string | undefined>(undefined);
  const [description, setDescription] = useState("");
  const [ty, setTy] = useState(MapType.Square);
  const [ffa, setFfa] = useState(false);

  const newMapControlsDisabled = useMemo(() => props.map !== undefined, [props.map]);
  const firstAdventure = useMemo(
    () => props.adventures !== undefined ? fluent(props.adventures).first() : undefined,
    [props.adventures]
  );

  const isSaveDisabled = useMemo(
    () => name.length === 0 || description.length === 0 || isSaving,
    [isSaving, name, description]
  );

  const saveText = useMemo(() => isSaving ? "Saving..." : "Save map", [isSaving]);

  useEffect(() => {
    setName(props.map?.record.name ?? "");
    setAdventureId(props.map?.adventureId ?? firstAdventure?.id);
    setDescription(props.map?.record.description ?? "");
    setTy(props.map?.record.ty ?? MapType.Square);
    setFfa(props.map?.record.ffa ?? false);
    setIsSaving(false);
  }, [props.map, firstAdventure, setName, setAdventureId, setDescription, setTy, setFfa, setIsSaving]);

  const handleFfaChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => setFfa(e.currentTarget.checked),
    [setFfa]
  );

  const handleSave = useCallback(() => {
    if (adventureId === undefined) {
      return;
    }

    setIsSaving(true);
    if (props.map !== undefined) {
      // This is an edit of an existing map:
      props.handleSave(adventureId, {
        ...props.map.record,
        name: name,
        description: description,
        ffa: ffa
      }).then(() => console.log("edited map " + props.map?.id))
        .catch(e => setIsSaving(false));
      return;
    }

    // We're adding a new map.
    // There must be a valid adventure to add it to and a valid user
    const adventureName = props.adventures?.find(a => a.id === adventureId)?.name;
    const uid = userContext.user?.uid;
    if (adventureName === undefined || uid === undefined) {
      return;
    }

    props.handleSave(adventureId, {
      adventureName: adventureName,
      name: name,
      description: description,
      owner: uid,
      ty: ty,
      ffa: ffa
    }).then(() => console.log("created new map"))
      .catch(e => setIsSaving(false));
  }, [props, adventureId, description, ffa, name, setIsSaving, ty, userContext.user]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Map settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="mapNameInput">Map name</Form.Label>
            <Form.Control id="mapNameInput" type="text" maxLength={30} value={name}
              onChange={e => setName(e.target.value)} />
          </Form.Group>
          {props.adventures !== undefined && props.adventures.length > 0 ?
            <Form.Group>
              <Form.Label htmlFor="mapAdventureSelect">Adventure this map is in</Form.Label>
              <Form.Control id="mapAdventureSelect" as="select" value={adventureId}
                disabled={newMapControlsDisabled}
                onChange={e => setAdventureId(e.target.value)}>
                {props.adventures?.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
              </Form.Control>
            </Form.Group> : <div></div>
          }
          <Form.Group>
            <Form.Label htmlFor="mapDescriptionInput">Map description</Form.Label>
            <Form.Control id="mapDescriptionInput" as="textarea" rows={5} maxLength={300}
              value={description} onChange={e => setDescription(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="mapType">Map type</Form.Label>
            <Form.Control id="mapType" as="select" value={ty}
              disabled={newMapControlsDisabled}
              onChange={e => setTy(e.target.value as MapType)}>
              <option>{MapType.Hex}</option>
              <option>{MapType.Square}</option>
            </Form.Control>
          </Form.Group>
          <Form.Group>
            <Form.Check type="checkbox" label="Free-for-all mode" checked={ffa}
              onChange={handleFfaChange} />
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

export default MapEditorModal;