import React, { useCallback, useEffect, useState } from 'react';

import ColourSelection from './ColourSelection';
import TokenPlayerSelection from './TokenPlayerSelection';

import { IPlayer } from '../data/adventure';
import { IToken, ITokenProperties } from '../data/feature';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';

import { v4 as uuidv4 } from 'uuid';

interface ITokenEditorModalProps {
  selectedColour: number;
  show: boolean;
  token: IToken | undefined;
  players: IPlayer[];
  handleClose: () => void;
  handleDelete: () => void;
  handleSave: (properties: ITokenProperties) => void;
}

function TokenEditorModal(props: ITokenEditorModalProps) {
  const [text, setText] = useState("");
  const [colour, setColour] = useState(0);
  const [playerIds, setPlayerIds] = useState([] as string[]);
  const [note, setNote] = useState("");
  const [noteVisibleToPlayers, setNoteVisibleToPlayers] = useState(true);

  useEffect(() => {
    if (props.show) {
      setText(props.token?.text ?? "");
      setColour(props.token?.colour ?? props.selectedColour);
      setPlayerIds(props.token?.players ?? []);
      setNote(props.token?.note ?? "");
      setNoteVisibleToPlayers(props.token?.noteVisibleToPlayers ?? false);
    }
  }, [props.selectedColour, props.show, props.token]);

  const [saveDisabled, setSaveDisabled] = useState(false);
  useEffect(() => {
    setSaveDisabled(text.length === 0);
  }, [text]);

  const handleVtoPChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteVisibleToPlayers(e.currentTarget.checked);
  }, [setNoteVisibleToPlayers]);

  const handleSave = useCallback(() => {
    props.handleSave({
      colour: colour,
      // If this was a new token, make a new id for it
      id: props.token === undefined ? uuidv4() : props.token.id,
      text: text,
      players: playerIds,
      size: 1, // TODO #116 Add in a token size slider thingy
      note: note,
      noteVisibleToPlayers: noteVisibleToPlayers
    });
  }, [colour, note, noteVisibleToPlayers, playerIds, props, text]);

  return (
    <Modal show={props.show} onHide={props.handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Token</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form>
          <Form.Group>
            <Form.Label htmlFor="tokenLabel">Label (maximum 3 characters)</Form.Label>
            <Form.Control id="tokenLabel" type="text" maxLength={3} value={text}
              onChange={e => setText(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="tokenNoteText">Note text</Form.Label>
            <Form.Control id="tokenNoteText" type="text" maxLength={30} value={note}
              onChange={e => setNote(e.target.value)} />
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="tokenColour">Colour</Form.Label>
            <Form.Row>
              <ColourSelection id="tokenColour"
                hidden={false}
                includeNegative={false}
                isVertical={false}
                selectedColour={colour}
                setSelectedColour={setColour} />
            </Form.Row>
          </Form.Group>
          <Form.Group>
            <Form.Label htmlFor="tokenPlayerSelect">Assigned to players</Form.Label>
            <TokenPlayerSelection id="tokenPlayerSelect" players={props.players}
              tokenPlayerIds={playerIds} setTokenPlayerIds={setPlayerIds} />
          </Form.Group>
          <Form.Group>
            <Form.Check type="checkbox" label="Note visible to players" checked={noteVisibleToPlayers}
              onChange={handleVtoPChange} />
          </Form.Group>
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={props.handleDelete}>Delete</Button>
        <Button variant="secondary" onClick={props.handleClose}>Close</Button>
        <Button variant="primary"
          disabled={saveDisabled}
          onClick={handleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default TokenEditorModal;