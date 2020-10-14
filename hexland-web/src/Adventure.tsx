import React, { useContext, useEffect, useReducer, useState, useMemo, useCallback } from 'react';
import './App.css';

import AdventureModal from './components/AdventureModal';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import ImageCardContent from './components/ImageCardContent';
import ImageDeletionModal from './components/ImageDeletionModal';
import ImagePickerModal from './components/ImagePickerModal';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import PlayerInfoList from './components/PlayerInfoList';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure, IPlayer, IMapSummary } from './data/adventure';
import { IIdentified } from './data/identified';
import { IImage } from './data/image';
import { IMap } from './data/map';
import { getUserPolicy } from './data/policy';
import { deleteMap, registerAdventureAsRecent, editAdventure, deleteAdventure, leaveAdventure, removeAdventureFromRecent, editMap } from './services/extensions';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

import { Link, RouteComponentProps, useHistory } from 'react-router-dom';
import { faImage } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { v4 as uuidv4 } from 'uuid';

interface IAdventureProps {
  adventureId: string;
}

function Adventure({ adventureId }: IAdventureProps) {
  const { dataService, functionsService, user } = useContext(UserContext);
  const { analytics, logError } = useContext(AnalyticsContext);
  const profile = useContext(ProfileContext);
  const { toasts } = useContext(StatusContext);
  const history = useHistory();

  const userPolicy = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level),
    [profile]
  );

  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    const uid = user?.uid;
    if (uid === undefined) {
      return;
    }

    const d = dataService?.getAdventureRef(adventureId);
    const playerRef = dataService?.getPlayerRef(adventureId, uid);
    if (d === undefined || playerRef === undefined) {
      return;
    }

    // How to handle an adventure load failure.
    function couldNotLoad(message: string) {
      toasts.next({
        id: uuidv4(),
        record: { title: 'Error loading adventure', message: message }
      });

      const uid = user?.uid;
      if (uid && d) {
        removeAdventureFromRecent(dataService, uid, d.id)
          .catch(e => logError("Error removing adventure from recent", e));
      }

      history.replace('/');
    }

    // Check this adventure exists and can be fetched (the watch doesn't do this for us)
    // We do this by checking for the player record because that also allows us to check if
    // we're blocked; being blocked necessarily doesn't stop us from getting the adventure
    // from the db (only the maps), but showing it to the user in that state would *not*
    // be a helpful thing to do
    dataService?.get(playerRef)
      .then(r => {
        // Deliberately try not to show the player the difference between the adventure being
        // deleted and the player being blocked!  Might avoid a confrontation...
        if (r === undefined || r?.allowed === false) {
          couldNotLoad("That adventure does not exist.");
        }
      })
      .catch(e => {
        logError("Error checking for adventure " + adventureId + ": ", e);
        couldNotLoad(e.message);
      });

    analytics?.logEvent("select_content", {
      "content_type": "adventure",
      "item_id": adventureId
    });
    return dataService?.watch(d,
      a => setAdventure(a === undefined ? undefined : { id: adventureId, record: a }),
      e => logError("Error watching adventure " + adventureId + ": ", e));
  }, [dataService, user, analytics, logError, history, adventureId, toasts]);

  const title = useMemo(() => {
    if (adventure?.record.owner !== user?.uid) {
      return adventure?.record.name ?? "";
    }

    return (adventure?.record.name ?? "") + " (" + (adventure?.record.maps.length ?? 0) + "/" + (userPolicy?.maps ?? 0) + ")";
  }, [adventure, user, userPolicy]);

  // Track changes to the adventure
  useEffect(() => {
    const uid = user?.uid;
    if (
      dataService === undefined || adventure === undefined ||
      uid === undefined
    ) {
      return;
    }

    registerAdventureAsRecent(dataService, uid, adventure.id, adventure.record)
      .then(() => console.log("registered adventure " + adventure.id + " as recent"))
      .catch(e => logError("Failed to register adventure " + adventure.id + " as recent", e));
  }, [logError, dataService, user, adventure]);

  // Derive the adventures list for the map collection
  const adventures = useMemo(
    () => adventure === undefined ? [] : [summariseAdventure(adventure.id, adventure.record)],
    [adventure]
  );

  // We want to be able to set the "create invite link" button's text to "Creating..." while it's
  // happening, which might take a moment:
  const [createInviteButtonDisabled, setCreateInviteButtonDisabled] = useState(false);
  const createInviteText = useMemo(
    () => createInviteButtonDisabled ? "Creating invite link..." : "Create invite link",
    [createInviteButtonDisabled]
  );

  useEffect(() => {
    if (adventureId) {
      setCreateInviteButtonDisabled(false);
    }
  }, [adventureId, setCreateInviteButtonDisabled]);

  // Invitations
  const [inviteLink, setInviteLink] = useState<string | undefined>(undefined);
  const createInviteLink = useCallback(() => {
    if (adventure === undefined || functionsService === undefined) {
      return;
    }

    setCreateInviteButtonDisabled(true);
    analytics?.logEvent("share", { "content_type": "adventure", "item_id": adventureId });
    functionsService.inviteToAdventure(adventure.id)
      .then(l => setInviteLink(adventureId + "/invite/" + l))
      .catch(e => {
        setCreateInviteButtonDisabled(false);
        logError("Failed to create invite link for " + adventureId, e);
      });
  }, [adventure, analytics, logError, adventureId, setCreateInviteButtonDisabled, setInviteLink, functionsService]);

  // Adventure editing support
  const [players, setPlayers] = useState<IPlayer[]>([]);
  useEffect(() => {
    if (dataService === undefined) {
      setPlayers([]);
      return () => {};
    }

    return dataService.watchPlayers(
      adventureId,
      setPlayers,
      e => logError("Failed to watch players of adventure " + adventureId, e)
    );
  }, [logError, dataService, adventureId]);

  const playersTitle = useMemo(() => {
    if (adventure?.record.owner !== user?.uid) {
      return "Players";
    }
    
    return "Players (" + players.filter(p => p.allowed !== false).length + "/" + (userPolicy?.players ?? 0) + ")";
  }, [adventure, players, user, userPolicy]);

  const canEditAdventure = useMemo(
    () => adventure?.record.owner === user?.uid,
    [user, adventure]
  );

  const canCreateNewMap = useMemo(() => {
    if (canEditAdventure === false || userPolicy === undefined || adventure === undefined) {
      return false;
    }

    return adventure.record.maps.length < userPolicy.maps;
  }, [adventure, canEditAdventure, userPolicy]);

  const [showEditAdventure, setShowEditAdventure] = useState(false);
  const [editAdventureName, setEditAdventureName] = useState("");
  const [editAdventureDescription, setEditAdventureDescription] = useState("");

  // Adventure image support
  const [showImagePicker, setShowImagePicker] = useState(false);
  const [pickImageForMap, setPickImageForMap] = useState<IMapSummary | undefined>(undefined);
  const [showImageDeletion, setShowImageDeletion] = useState(false);
  const [imageToDelete, setImageToDelete] = useState<IImage | undefined>(undefined);

  // Adventure deletion support
  const canDeleteAdventure = useMemo(
    () => canEditAdventure && adventure?.record.maps.length === 0,
    [canEditAdventure, adventure]
  );
  const cannotDeleteAdventure = useMemo(() => canDeleteAdventure === false, [canDeleteAdventure]);
  const [showDeleteAdventure, setShowDeleteAdventure] = useState(false);

  // Support for leaving the adventure
  const canLeaveAdventure = useMemo(
    () => adventure?.record.owner !== user?.uid,
    [user, adventure]
  );
  const [showLeaveAdventure, setShowLeaveAdventure] = useState(false);

  // Support for the players list
  const ownerUid = useMemo(() => adventure?.record.owner, [adventure]);
  const showBlockButtons = useMemo(() => ownerUid === user?.uid, [ownerUid, user]);
  const showShowBlockedToggle = useMemo(
    () => showBlockButtons && players.find(p => p.allowed === false) !== undefined,
    [showBlockButtons, players]
  );

  const [showBlocked, toggleShowBlocked] = useReducer(state => !state, false);
  const [showBlockPlayer, setShowBlockPlayer] = useState(false);
  const [showUnblockPlayer, setShowUnblockPlayer] = useState(false);
  const [playerToBlock, setPlayerToBlock] = useState<IPlayer | undefined>(undefined);

  const showBlockedText = useMemo(() => showBlocked === true ? "Hide blocked" : "Show blocked", [showBlocked]);

  const handleModalClose = useCallback(() => {
    setShowBlockPlayer(false);
    setShowUnblockPlayer(false);
    setShowEditAdventure(false);
    setShowImageDeletion(false);
    setShowImagePicker(false);
    setShowDeleteAdventure(false);
    setShowLeaveAdventure(false);
  }, [setShowBlockPlayer, setShowUnblockPlayer, setShowEditAdventure, setShowImageDeletion, setShowImagePicker, setShowDeleteAdventure, setShowLeaveAdventure]);

  const handleShowBlockPlayer = useCallback((player: IPlayer) => {
    setShowBlockPlayer(true);
    setPlayerToBlock(player);
  }, [setPlayerToBlock, setShowBlockPlayer]);

  const handleShowUnblockPlayer = useCallback((player: IPlayer) => {
    setShowUnblockPlayer(true);
    setPlayerToBlock(player);
  }, [setPlayerToBlock, setShowUnblockPlayer]);

  const handleBlockPlayerSave = useCallback((allowed: boolean) => {
    handleModalClose();
    if (playerToBlock === undefined) {
      return;
    }

    const playerRef = dataService?.getPlayerRef(adventureId, playerToBlock.playerId);
    if (playerRef !== undefined) {
      dataService?.update(playerRef, { allowed: allowed })
        .catch(e => logError("Failed to block/unblock player", e));
    }
  }, [logError, handleModalClose, playerToBlock, adventureId, dataService]);

  const handleShowEditAdventure = useCallback(() => {
    if (adventure === undefined) {
      return;
    }

    setEditAdventureName(adventure.record.name);
    setEditAdventureDescription(adventure.record.description);
    setShowEditAdventure(true);
  }, [adventure, setEditAdventureName, setEditAdventureDescription, setShowEditAdventure]);

  const handleShowImagePicker = useCallback((map?: IMapSummary | undefined) => {
    if (adventure === undefined) {
      return;
    }

    setShowImagePicker(true);
    setPickImageForMap(map);
  }, [adventure, setPickImageForMap, setShowImagePicker]);

  const handleShowImageDeletion = useCallback((image: IImage | undefined) => {
    if (image === undefined) {
      return;
    }

    handleModalClose();
    setShowImageDeletion(true);
    setImageToDelete(image);
  }, [handleModalClose, setImageToDelete, setShowImageDeletion]);

  const handleEditAdventureSave = useCallback(async () => {
    handleModalClose();
    if (adventure === undefined) {
      return;
    }

    const updated = {
      ...adventure.record,
      name: editAdventureName,
      description: editAdventureDescription
    };

    await editAdventure(
      dataService, user?.uid, summariseAdventure(adventureId, updated)
    );
  }, [dataService, user, adventureId, adventure, editAdventureName, editAdventureDescription, handleModalClose]);

  const handleImagePickerSave = useCallback((path: string | undefined) => {
    handleModalClose();
    if (adventure === undefined || dataService === undefined) {
      return;
    }

    // We might be choosing an image for either the adventure or one of its maps
    if (pickImageForMap === undefined) {
      const updated: IAdventure = { ...adventure.record, imagePath: path ?? "" };
      editAdventure(
        dataService, user?.uid, summariseAdventure(adventureId, updated)
      )
        .then(() => console.log(`Adventure ${adventureId} successfully edited`))
        .catch(e => logError(`Error editing adventure ${adventureId}`, e));
    } else {
      const mapSummary = pickImageForMap;
      async function getAndUpdateMap() {
        if (dataService === undefined) {
          return;
        }

        // This is not transactional when it ought to be, but I'm not expecting that
        // two concurrent, conflicting writes to the same map record would be very likely
        const map = await dataService.get(dataService.getMapRef(
          mapSummary.adventureId, mapSummary.id
        ));
        if (!map) {
          throw Error("No map of id " + mapSummary.id);
        }

        const updated: IMap = { ...map, imagePath: path ?? "" };
        await editMap(dataService, mapSummary.adventureId, mapSummary.id, updated);
      }

      getAndUpdateMap()
        .then(() => console.log(`Map ${mapSummary.id} successfully edited`))
        .catch(e => logError(`Error editing map ${mapSummary.id}`, e));
    }
  }, [adventure, logError, handleModalClose, pickImageForMap, adventureId, dataService, user]);

  const handleImageDeletionSave = useCallback(() => {
    handleModalClose();
    if (imageToDelete === undefined || functionsService === undefined) {
      return;
    }

    functionsService.deleteImage(imageToDelete.path)
      .then(() => console.log(`deleted image ${imageToDelete.path}`))
      .catch(e => logError(`failed to delete image ${imageToDelete}`, e));
  }, [logError, handleModalClose, imageToDelete, functionsService]);

  const handleDeleteAdventureSave = useCallback(() => {
    handleModalClose();
    deleteAdventure(dataService, user?.uid, adventureId)
      .then(() => {
        console.log("Adventure " + adventureId + " successfully deleted");
        history.replace("/");
      })
      .catch(e => logError("Error deleting adventure " + adventureId, e));
  }, [dataService, user, adventureId, history, handleModalClose, logError]);

  const handleLeaveAdventureSave = useCallback(() => {
    handleModalClose();
    leaveAdventure(dataService, user?.uid, adventureId)
      .then(() => {
        console.log("Successfully left adventure " + adventureId);
        history.replace("/");
      })
      .catch(e => logError("Error leaving adventure " + adventureId, e));
  }, [dataService, user, logError, adventureId, handleModalClose, history]);

  const maps = useMemo(() => adventure?.record.maps ?? [], [adventure]);
  const mapDelete = useCallback((id: string) => {
    deleteMap(dataService, user?.uid, adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => logError("Error deleting map " + id, e));
  }, [dataService, user, adventureId, logError]);

  return (
    <div>
      <Navigation>{title}</Navigation>
      <Container>
        {adventure !== undefined ?
          <Row className="mt-4">
            <Col>
              <CardDeck>
                <Card bg="dark" text="white">
                  <ImageCardContent altName={adventure.record.name} imagePath={adventure.record.imagePath}>
                    <div className="card-content-spaced">
                      <div className="card-body-spaced">
                        <div className="card-row-spaced">
                          <Card.Title>{adventure.record.name}</Card.Title>
                          {canEditAdventure === true ?
                            <ButtonGroup className="ml-2">
                              <Button variant="primary" onClick={handleShowEditAdventure}>Edit</Button>
                              <Button variant="primary" onClick={() => handleShowImagePicker()}>
                                <FontAwesomeIcon icon={faImage} color="white" />
                              </Button>
                            </ButtonGroup> :
                            <div></div>
                          }
                        </div>
                        <Card.Text>{adventure.record.description}</Card.Text>
                      </div>
                      <div className="card-row-spaced">
                        {canEditAdventure !== true ? <div></div> : inviteLink === undefined ?
                          <Button variant="primary" disabled={createInviteButtonDisabled} onClick={createInviteLink}>{createInviteText}</Button> :
                          <Link to={inviteLink}>Send this link to other players to invite them.</Link>
                        }
                        {canEditAdventure === true ?
                          <Button variant="danger" onClick={() => setShowDeleteAdventure(true)}>Delete adventure</Button> :
                          canLeaveAdventure === true ? <Button variant="warning" onClick={() => setShowLeaveAdventure(true)}>Leave adventure</Button> :
                            <div></div>
                        }
                      </div>
                    </div>
                  </ImageCardContent>
                </Card>
                <Card bg="dark" text="white">
                  <Card.Header className="card-header-spaced">
                    <div>{playersTitle}</div>
                    {showShowBlockedToggle ?
                      <Button variant="secondary" onClick={toggleShowBlocked}>{showBlockedText}</Button> :
                      <div></div>
                    }
                  </Card.Header>
                  <PlayerInfoList ownerUid={ownerUid} players={players} tokens={[]}
                    showBlockedPlayers={showBlocked}
                    showBlockButtons={showBlockButtons}
                    blockPlayer={handleShowBlockPlayer}
                    unblockPlayer={handleShowUnblockPlayer} />
                </Card>
              </CardDeck>
            </Col>
          </Row>
          : <div></div>
        }
        <Row className="mt-4">
          <Col>
            <MapCollection
              adventures={adventures}
              maps={maps}
              showNewMap={canCreateNewMap}
              deleteMap={mapDelete}
              pickImage={handleShowImagePicker} />
          </Col>
        </Row>
      </Container>
      <AdventureModal
        description={editAdventureDescription}
        name={editAdventureName}
        show={showEditAdventure}
        handleClose={handleModalClose}
        handleSave={handleEditAdventureSave}
        setDescription={setEditAdventureDescription}
        setName={setEditAdventureName} />
      <ImagePickerModal
        show={showImagePicker}
        handleClose={handleModalClose}
        handleDelete={handleShowImageDeletion}
        handleSave={handleImagePickerSave} />
      <ImageDeletionModal
        image={imageToDelete}
        show={showImageDeletion}
        handleClose={handleModalClose}
        handleDelete={handleImageDeletionSave} />
      <Modal show={showBlockPlayer} onHide={handleModalClose}>
        <Modal.Header>
          <Modal.Title>Block {playerToBlock?.playerName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Do you really want to block {playerToBlock?.playerName}?  They will no longer be able to watch or join in with this adventure.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Cancel</Button>
          <Button variant="danger" onClick={() => handleBlockPlayerSave(false)}>
            Yes, block player!
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showUnblockPlayer} onHide={handleModalClose}>
        <Modal.Header>
          <Modal.Title>Unblock {playerToBlock?.playerName}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>Do you really want to unblock {playerToBlock?.playerName}?  They will once again be able to watch or join in with this adventure.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Cancel</Button>
          <Button variant="success" onClick={() => handleBlockPlayerSave(true)}>
            Yes, unblock player!
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showDeleteAdventure} onHide={handleModalClose}>
        <Modal.Header>
          <Modal.Title>Delete adventure</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {canDeleteAdventure ? <p>Do you really want to delete this adventure?</p> :
          <p>Adventures with maps cannot be deleted.</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Cancel</Button>
          <Button disabled={cannotDeleteAdventure} variant="danger" onClick={handleDeleteAdventureSave}>
            Yes, delete adventure!
          </Button>
        </Modal.Footer>
      </Modal>
      <Modal show={showLeaveAdventure} onHide={handleModalClose}>
        <Modal.Header>
          <Modal.Title>Leave adventure</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>You will no longer be able to see maps in or participate in this adventure.</p>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Cancel</Button>
          <Button variant="danger" onClick={handleLeaveAdventureSave}>
            Yes, leave adventure!
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

function AdventurePage(props: RouteComponentProps<IAdventureProps>) {
  return (
    <RequireLoggedIn>
      <Adventure adventureId={props.match.params.adventureId} />
    </RequireLoggedIn>
  );
}

export default AdventurePage;