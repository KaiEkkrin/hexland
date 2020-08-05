import React, { useEffect, useState } from 'react';

import { IMap } from '../data/map';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

interface IMapEditorModalProps {
  show: boolean;
  map: IMap | undefined;
  handleClose: () => void;
  handleSave: (ffa: boolean) => void;
}

function MapEditorModal(props: IMapEditorModalProps) {
  const [ffa, setFfa] = useState(false);

  useEffect(() => {
    setFfa(props.map?.ffa ?? false);
  }, [props.map]);

  function handleFfaChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFfa(e.currentTarget.checked);
  }

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Map settings</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Check type="checkbox" label="Free-for-all mode" checked={ffa}
              onChange={handleFfaChange} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" onClick={() => props.handleSave(ffa)}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default MapEditorModal;