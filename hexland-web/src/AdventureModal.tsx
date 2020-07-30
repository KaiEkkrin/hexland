import React from 'react';
import './App.css';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

interface IAdventureModalProps {
  getDescription: () => string;
  getName: () => string;
  getShow: () => boolean;
  handleClose: () => void;
  handleSave: () => void;
  setDescription: (value: string) => void;
  setName: (value: string) => void;
}

function AdventureModal(props: IAdventureModalProps) {
  return (
    <Modal show={props.getShow()} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Adventure</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Name</Form.Label>
            <Form.Control type="text" maxLength={30} value={props.getName()}
              onChange={e => props.setName(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Description</Form.Label>
            <Form.Control as="textarea" rows={5} maxLength={300} value={props.getDescription()}
              onChange={e => props.setDescription(e.target.value)} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary" disabled={props.getName().length === 0}
          onClick={props.handleSave}>
          Save
      </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default AdventureModal;
