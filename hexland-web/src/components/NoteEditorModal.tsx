import React, { useEffect, useState } from 'react';

import { IAnnotation } from '../data/annotation';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import { v4 as uuidv4 } from 'uuid';

interface INoteEditorModalProps {
  show: boolean;
  note: IAnnotation | undefined;
  handleClose: () => void;
  handleDelete: () => void;
  handleSave: (id: string, colour: number, text: string, visibleToPlayers: boolean) => void;
}

function NoteEditorModal(props: INoteEditorModalProps) {
  const [id, setId] = useState("");
  const [colour, setColour] = useState(0); // TODO do something with this?
  const [text, setText] = useState("");
  const [visibleToPlayers, setVisibleToPlayers] = useState(false);

  useEffect(() => {
    if (props.show) {
      setId(props.note?.id ?? uuidv4());
      setColour(props.note?.colour ?? 0);
      setText(props.note?.text ?? "");
      setVisibleToPlayers(props.note?.visibleToPlayers ?? false);
    }
  }, [props.show, props.note]);

  const [saveDisabled, setSaveDisabled] = useState(false);
  useEffect(() => {
    setSaveDisabled(text.length === 0);
  }, [text]);

  function handleVtoPChange(e: React.ChangeEvent<HTMLInputElement>) {
    setVisibleToPlayers(e.currentTarget.checked);
  }

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Note</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="noteText">Text</Form.Label>
            <Form.Control id="noteText" type="text" maxLength={30} value={text}
              onChange={e => setText(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Check type="checkbox" label="Visible to players" checked={visibleToPlayers}
              onChange={handleVtoPChange} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={props.handleDelete}>Delete</Button>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary"
          disabled={saveDisabled}
          onClick={() => props.handleSave(id, colour, text, visibleToPlayers)}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default NoteEditorModal;