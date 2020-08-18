import React, { useMemo } from 'react';
import '../App.css';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

interface IAdventureModalProps {
  description: string;
  name: string;
  show: boolean;
  handleClose: () => void;
  handleSave: () => void;
  setDescription: (value: string) => void;
  setName: (value: string) => void;
}

function AdventureModal(props: IAdventureModalProps) {
  const isSaveDisabled = useMemo(() => props.name.length === 0, [props.name]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Adventure</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="adventureNameInput">Adventure name</Form.Label>
            <Form.Control id="adventureNameInput" type="text" maxLength={30} value={props.name}
              onChange={e => props.setName(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="adventureDescriptionInput">Adventure description</Form.Label>
            <Form.Control id="adventureDescriptionInput" as="textarea" rows={5} maxLength={300}
              value={props.description} onChange={e => props.setDescription(e.target.value)} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={isSaveDisabled}
          onClick={props.handleSave}>
          Save adventure
      </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default AdventureModal;