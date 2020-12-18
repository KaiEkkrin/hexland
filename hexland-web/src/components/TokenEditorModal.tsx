import React, { useCallback, useEffect, useMemo, useState } from 'react';

import ColourSelection from './ColourSelection';
import TokenImageEditor from './TokenImageEditor';
import TokenPlayerSelection from './TokenPlayerSelection';

import { IPlayer } from '../data/adventure';
import { ITokenProperties, TokenSize } from '../data/feature';
import { IImage } from '../data/image';
import { ISprite } from '../data/sprite';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import { v4 as uuidv4 } from 'uuid';
import fluent from 'fluent-iterable';

interface ITokenSizeSelectionProps {
  size: TokenSize;
  sizes: TokenSize[] | undefined;
  setSize: (value: TokenSize) => void;
}

export function TokenSizeSelection({ size, sizes, setSize }: ITokenSizeSelectionProps) {
  const sizeOptions = useMemo(
    () => sizes?.map(sz => (<option key={sz} value={sz}>{sz}</option>)),
    [sizes]
  );
  const sizeString = useMemo(() => String(size), [size]);
  const handleSizeChange = useCallback((e: React.FormEvent<HTMLSelectElement>) => {
    const option = e.currentTarget.selectedOptions[0];
    setSize(option.value as TokenSize);
  }, [setSize]);

  return (
    <Form.Group>
      <Form.Label htmlFor="tokenSizeSelect">Size</Form.Label>
      <Form.Control id="tokenSizeSelect" as="select" value={sizeString}
        onChange={e => handleSizeChange(e as any)}
      >
        {sizeOptions}
      </Form.Control>
    </Form.Group>
  );
}

interface ITokenEditorModalProps {
  adventureId: string;
  selectedColour: number;
  sizes: TokenSize[] | undefined;
  show: boolean;
  token: ITokenProperties | undefined;
  otherTokens: ITokenProperties[];
  players: IPlayer[];
  handleClose: () => void;
  handleDelete: () => void;
  handleImageDelete: (image: IImage | undefined) => void;
  handleSave: (properties: ITokenProperties) => void;
}

// This modal is only for editing tokens that aren't attached to a character.
// For that (and never the twain shall meet), see CharacterTokenEditorModal.
function TokenEditorModal(
  { adventureId, selectedColour, sizes, show, token, otherTokens, players,
    handleClose, handleDelete, handleImageDelete, handleSave }: ITokenEditorModalProps
) {
  const [text, setText] = useState("");
  const [colour, setColour] = useState(0);
  const [size, setSize] = useState<TokenSize>("1");
  const [playerIds, setPlayerIds] = useState([] as string[]);
  const [note, setNote] = useState("");
  const [noteVisibleToPlayers, setNoteVisibleToPlayers] = useState(true);
  const [sprites, setSprites] = useState<ISprite[]>([]);
  const [outline, setOutline] = useState(false);

  const [imageTabTitle, setImageTabTitle] = useState("Image");

  // Properties

  const possibleOutlineValues = useMemo(
    () => [false, true].filter(v => otherTokens.find(t => t.outline === v) === undefined),
    [otherTokens]
  );

  const outlineDisabled = useMemo(() => possibleOutlineValues.length < 2, [possibleOutlineValues]);
  useEffect(() => {
    if (show) {
      setText(token?.text ?? "");
      setColour(token?.colour ?? selectedColour);
      setSize(token?.size ?? "1");
      setPlayerIds(token?.players ?? []);
      setNote(token?.note ?? "");
      setNoteVisibleToPlayers(token?.noteVisibleToPlayers ?? false);
      setSprites(token?.sprites ?? []);
      setOutline(token?.outline ?? fluent(possibleOutlineValues).first() ?? false);
    }
  }, [
    possibleOutlineValues, selectedColour, show, token,
    setText, setColour, setSize, setPlayerIds, setNote, setNoteVisibleToPlayers, setOutline, setSprites,
  ]);

  const handleVtoPChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteVisibleToPlayers(e.currentTarget.checked);
  }, [setNoteVisibleToPlayers]);

  const handleOutlineChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setOutline(e.currentTarget.checked);
  }, [setOutline]);
  
  // Save

  // We can't save if there's no text/image, or if we're busy handling an image:
  const [busySettingImage, setBusySettingImage] = useState(false);
  const saveDisabled = useMemo(
    () => (text.length === 0 && sprites.length === 0) || busySettingImage,
    [busySettingImage, sprites, text]
  );

  const doHandleSave = useCallback(() => {
    handleSave({
      colour: colour,
      // If this was a new token, make a new id for it
      id: token === undefined ? uuidv4() : token.id,
      text: text,
      players: playerIds,
      size: size,
      note: note,
      noteVisibleToPlayers: noteVisibleToPlayers,
      characterId: "",
      sprites: sprites,
      outline: outline
    });
  }, [colour, note, noteVisibleToPlayers, playerIds, handleSave, token, size, text, sprites, outline]);

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header closeButton>
        <Modal.Title>Token</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Tabs defaultActiveKey="properties">
          <Tab eventKey="properties" title="Properties">
            <Form>
              <Form.Group>
                <Form.Label htmlFor="tokenLabel">Label (maximum 3 characters)</Form.Label>
                <Form.Control id="tokenLabel" type="text" maxLength={3} value={text}
                  onChange={e => setText(e.target.value)} />
                <Form.Text className="text-muted">
                  This is the text drawn on the token in maps. A token must have either this label, an image or both.
                </Form.Text>
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="tokenNoteText">Note text</Form.Label>
                <Form.Control id="tokenNoteText" type="text" maxLength={30} value={note}
                  onChange={e => setNote(e.target.value)} />
              </Form.Group>
              <Form.Group>
                <Form.Check type="checkbox" label="Note visible to players" checked={noteVisibleToPlayers}
                  onChange={handleVtoPChange} />
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
              <TokenSizeSelection size={size} sizes={sizes} setSize={setSize} />
              <Form.Group>
                <Form.Label htmlFor="tokenPlayerSelect">Assigned to players</Form.Label>
                <TokenPlayerSelection id="tokenPlayerSelect" players={players}
                  tokenPlayerIds={playerIds} setTokenPlayerIds={setPlayerIds} />
              </Form.Group>
              <Form.Group>
                <Form.Check type="checkbox" label="Outline token" checked={outline} disabled={outlineDisabled}
                  onChange={handleOutlineChange} />
                <Form.Text className="text-muted">
                  Outline tokens can exist in the same space as regular tokens, and cannot show an image.
                </Form.Text>
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="image" title={imageTabTitle} disabled={outline}>
            <TokenImageEditor adventureId={adventureId} altText={text} colour={colour} show={show}
              busySettingImage={busySettingImage} setBusySettingImage={setBusySettingImage}
              setImageTabTitle={setImageTabTitle}
              sprites={sprites} setSprites={setSprites} handleImageDelete={handleImageDelete} />
          </Tab>
        </Tabs>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="danger" onClick={handleDelete}>Delete</Button>
        <Button variant="secondary" onClick={handleClose}>Close</Button>
        <Button variant="primary"
          disabled={saveDisabled}
          onClick={doHandleSave}>Save</Button>
      </Modal.Footer>
    </Modal>
  );
}

export default TokenEditorModal;