import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import BusyElement from './BusyElement';
import ColourSelection from './ColourSelection';
import { ImagePickerForm } from './ImagePickerModal';
import { ProfileContext } from './ProfileContextProvider';
import SpriteImage from './SpriteImage';
import TokenPlayerSelection from './TokenPlayerSelection';
import { UserContext } from './UserContextProvider';

import { IPlayer } from '../data/adventure';
import { ITokenProperties, TokenSize } from '../data/feature';
import { IImage } from '../data/image';
import { getUserPolicy } from '../data/policy';
import { defaultSpriteGeometry, ISprite, toSpriteGeometryString } from '../data/sprite';
import { hexColours } from '../models/featureColour';
import { ISpritesheetCache } from '../services/interfaces';

import Button from 'react-bootstrap/Button';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Tab from 'react-bootstrap/Tab';
import Tabs from 'react-bootstrap/Tabs';

import { v4 as uuidv4 } from 'uuid';

interface ITokenEditorModalProps {
  adventureId: string;
  mapId: string;
  spritesheetCache: ISpritesheetCache | undefined;
  selectedColour: number;
  sizes: TokenSize[] | undefined;
  show: boolean;
  token: ITokenProperties | undefined;
  players: IPlayer[];
  handleClose: () => void;
  handleDelete: () => void;
  handleImageDelete: (image: IImage | undefined) => void;
  handleSave: (properties: ITokenProperties) => void;
}

function TokenEditorModal(
  { adventureId, mapId, spritesheetCache, selectedColour, sizes, show, token, players,
    handleClose, handleDelete, handleImageDelete, handleSave }: ITokenEditorModalProps
) {
  const { logError } = useContext(AnalyticsContext);
  const { functionsService } = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const maxImages = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level).images,
    [profile]
  );

  const [text, setText] = useState("");
  const [colour, setColour] = useState(0);
  const [size, setSize] = useState<TokenSize>("1");
  const [playerIds, setPlayerIds] = useState([] as string[]);
  const [note, setNote] = useState("");
  const [noteVisibleToPlayers, setNoteVisibleToPlayers] = useState(true);
  const [sprites, setSprites] = useState<ISprite[]>([]);

  // Properties

  useEffect(() => {
    if (show) {
      setText(token?.text ?? "");
      setColour(token?.colour ?? selectedColour);
      setSize(token?.size ?? "1");
      setPlayerIds(token?.players ?? []);
      setNote(token?.note ?? "");
      setNoteVisibleToPlayers(token?.noteVisibleToPlayers ?? false);
      setSprites(token?.sprites ?? []);
    }
  }, [selectedColour, show, token]);

  const sizeOptions = useMemo(
    () => sizes?.map(sz => (<option key={sz} value={sz}>{sz}</option>)),
    [sizes]
  );
  const sizeString = useMemo(() => String(size), [size]);
  const handleSizeChange = useCallback((e: React.FormEvent<HTMLSelectElement>) => {
    const option = e.currentTarget.selectedOptions[0];
    setSize(option.value as TokenSize);
  }, [setSize]);

  const handleVtoPChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setNoteVisibleToPlayers(e.currentTarget.checked);
  }, [setNoteVisibleToPlayers]);

  // The current image, if any

  const currentImage = useMemo(() => {
    if (sprites === undefined || sprites.length === 0) {
      return (<p>No image is displayed for this token.</p>);
    }

    const altName = "Image for " + text;
    return (
      <React.Fragment>
        Current image&nbsp;
        <SpriteImage sprite={sprites[0]} altName={altName} size={128} spritesheetCache={spritesheetCache}
          borderColour={hexColours[colour]} />
      </React.Fragment>
    );
  }, [colour, sprites, spritesheetCache, text]);

  // Image picking
  // TODO #149 Show the image currently in use (if any) above the image picker.

  const [activeImage, setActiveImage] = useState<IImage | undefined>(undefined);
  const [imageCount, setImageCount] = useState(0);
  const imageTabTitle = useMemo(() => `Images (${imageCount}/${maxImages})`, [imageCount, maxImages]);

  // We'll hide "set image" while creating the sprite, since that might take a moment:
  const canSetImage = useMemo(() => activeImage !== undefined, [activeImage]);
  const [busySettingImage, setBusySettingImage] = useState(false);
  const setImageDisabled = useMemo(() => busySettingImage || !canSetImage, [busySettingImage, canSetImage]);

  const handleDeleteImage = useCallback(
    () => handleImageDelete(activeImage),
    [activeImage, handleImageDelete]
  );

  const handleSetImage = useCallback((image: IImage | undefined) => {
    if (image === undefined) {
      setSprites([]);
      return;
    }

    if (functionsService === undefined) {
      return;
    }

    setBusySettingImage(true);
    functionsService.addSprites(
      adventureId, mapId, toSpriteGeometryString(defaultSpriteGeometry), [image.path]
    ).then(s => {
      console.log(`setting sprite to ${image.path}`);
      setSprites(s.filter(s2 => s2.source === image.path));
      setBusySettingImage(false);
    }).catch(e => {
      logError(`Failed to set sprite to ${image.path}`, e);
      setBusySettingImage(false);
    })
  }, [adventureId, functionsService, logError, mapId, setSprites]);

  const handleUseNoImage = useCallback(() => handleSetImage(undefined), [handleSetImage]);
  const handleUseImage = useCallback(() => handleSetImage(activeImage), [activeImage, handleSetImage]);
  
  // Save

  const [saveDisabled, setSaveDisabled] = useState(false);
  useEffect(() => {
    setSaveDisabled(text.length === 0);
  }, [text]);

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
      sprites: sprites
    });
  }, [colour, note, noteVisibleToPlayers, playerIds, handleSave, token, size, text, sprites]);

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
                <Form.Label htmlFor="tokenSizeSelect">Size</Form.Label>
                <Form.Control id="tokenSizeSelect" as="select" value={sizeString} onChange={e => handleSizeChange(e as any)}>
                  {sizeOptions}
                </Form.Control>
              </Form.Group>
              <Form.Group>
                <Form.Label htmlFor="tokenPlayerSelect">Assigned to players</Form.Label>
                <TokenPlayerSelection id="tokenPlayerSelect" players={players}
                  tokenPlayerIds={playerIds} setTokenPlayerIds={setPlayerIds} />
              </Form.Group>
              <Form.Group>
                <Form.Check type="checkbox" label="Note visible to players" checked={noteVisibleToPlayers}
                  onChange={handleVtoPChange} />
              </Form.Group>
            </Form>
          </Tab>
          <Tab eventKey="image" title={imageTabTitle}>
            <div>
              {currentImage}
            </div>
            <ImagePickerForm show={show} setActiveImage={setActiveImage} setImageCount={setImageCount}
              handleDelete={handleDeleteImage} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
              <Button variant="warning" onClick={handleUseNoImage}>Use no image</Button>
              <Button className="ml-2" variant="primary" onClick={handleUseImage} disabled={setImageDisabled}>
                <BusyElement normal="Use image" busy="Setting image..." isBusy={setImageDisabled} />
              </Button>
            </div>
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