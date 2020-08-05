import React, { useEffect, useState } from 'react';

import ColourSelection from './ColourSelection';
import TokenPlayerSelection from './TokenPlayerSelection';

import { IPlayer } from '../data/adventure';
import { IToken } from '../data/feature';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

interface ITokenEditorModalProps {
  selectedColour: number;
  show: boolean;
  token: IToken | undefined;
  hexColours: string[];
  players: IPlayer[];
  handleClose: () => void;
  handleDelete: () => void;
  handleSave: (text: string, colour: number, playerIds: string[]) => void;
}

function TokenEditorModal(props: ITokenEditorModalProps) {
  const [text, setText] = useState("");
  const [colour, setColour] = useState(0);
  const [playerIds, setPlayerIds] = useState([] as string[]);

  useEffect(() => {
    if (props.show) {
      setText(props.token?.text ?? "");
      setColour(props.token?.colour ?? props.selectedColour);
      setPlayerIds(props.token?.players ?? []);
    }
  }, [props.selectedColour, props.show, props.token]);

  const [saveDisabled, setSaveDisabled] = useState(false);
  useEffect(() => {
    setSaveDisabled(text.length === 0);
  }, [text]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Token</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label>Text</Form.Label>
            <Form.Control type="text" maxLength={3} value={text}
              onChange={e => setText(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label>Colour</Form.Label>
            <Form.Row>
              <ColourSelection colours={props.hexColours}
                includeNegative={false}
                isVertical={false}
                getSelectedColour={() => colour}
                setSelectedColour={setColour} />
            </Form.Row>
          </Form.Group>
          <Form.Group>
            <Form.Label>Assigned to players</Form.Label>
            <TokenPlayerSelection players={props.players}
              tokenPlayerIds={playerIds} setTokenPlayerIds={setPlayerIds} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={props.handleDelete}>Delete</Button>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary"
          disabled={saveDisabled}
          onClick={() => props.handleSave(text, colour, playerIds)}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default TokenEditorModal;