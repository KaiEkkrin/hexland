import React from 'react';

import { ITokenProperties } from '../data/feature';

import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';

interface ITokenDeletionModalProps {
  show: boolean;
  tokens: ITokenProperties[];
  handleClose: () => void;
  handleDelete: () => void;
}

function TokenDeletionModal(props: ITokenDeletionModalProps) {
  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Delete tokens</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p>You are about to delete {props.tokens.length} tokens.  Are you sure?</p>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="danger" onClick={props.handleDelete}>Yes, delete token!</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default TokenDeletionModal;