import React, { useContext, useEffect, useReducer, useState, useMemo, useCallback } from 'react';
import './App.css';

import AdventureModal from './components/AdventureModal';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import ImagePickerModal from './components/ImagePickerModal';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import PlayerInfoList from './components/PlayerInfoList';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure, IPlayer } from './data/adventure';
import { IIdentified } from './data/identified';
import { getUserPolicy } from './data/policy';
import { deleteMap, registerAdventureAsRecent, editAdventure, deleteAdventure, leaveAdventure, removeAdventureFromRecent } from './services/extensions';

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

function Adventure(props: IAdventureProps) {
  const userContext = useContext(UserContext);
  const analyticsContext = useContext(AnalyticsContext);
  const profile = useContext(ProfileContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  const userPolicy = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level),
    [profile]
  );

  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    const uid = userContext.user?.uid;
    if (uid === undefined) {
      return;
    }

    const d = userContext.dataService?.getAdventureRef(props.adventureId);
    const playerRef = userContext.dataService?.getPlayerRef(props.adventureId, uid);
    if (d === undefined || playerRef === undefined) {
      return;
    }

    // How to handle an adventure load failure.
    function couldNotLoad(message: string) {
      statusContext.toasts.next({
        id: uuidv4(),
        record: { title: 'Error loading adventure', message: message }
      });

      const uid = userContext.user?.uid;
      if (uid && d) {
        removeAdventureFromRecent(userContext.dataService, uid, d.id)
          .catch(e => analyticsContext.logError("Error removing adventure from recent", e));
      }

      history.replace('/');
    }

    // Check this adventure exists and can be fetched (the watch doesn't do this for us)
    // We do this by checking for the player record because that also allows us to check if
    // we're blocked; being blocked necessarily doesn't stop us from getting the adventure
    // from the db (only the maps), but showing it to the user in that state would *not*
    // be a helpful thing to do
    userContext.dataService?.get(playerRef)
      .then(r => {
        // Deliberately try not to show the player the difference between the adventure being
        // deleted and the player being blocked!  Might avoid a confrontation...
        if (r === undefined || r?.allowed === false) {
          couldNotLoad("That adventure does not exist.");
        }
      })
      .catch(e => {
        analyticsContext.logError("Error checking for adventure " + props.adventureId + ": ", e);
        couldNotLoad(e.message);
      });

    analyticsContext.analytics?.logEvent("select_content", {
      "content_type": "adventure",
      "item_id": props.adventureId
    });
    return userContext.dataService?.watch(d,
      a => setAdventure(a === undefined ? undefined : { id: props.adventureId, record: a }),
      e => analyticsContext.logError("Error watching adventure " + props.adventureId + ": ", e));
  }, [userContext, analyticsContext, history, props.adventureId, statusContext]);

  const title = useMemo(() => {
    if (adventure?.record.owner !== userContext.user?.uid) {
      return adventure?.record.name ?? "";
    }

    return (adventure?.record.name ?? "") + " (" + (adventure?.record.maps.length ?? 0) + "/" + (userPolicy?.maps ?? 0) + ")";
  }, [adventure, userContext, userPolicy]);

  // Track changes to the adventure
  useEffect(() => {
    const uid = userContext.user?.uid;
    if (
      userContext.dataService === undefined || adventure === undefined ||
      uid === undefined
    ) {
      return;
    }

    registerAdventureAsRecent(userContext.dataService, uid, adventure.id, adventure.record)
      .then(() => console.log("registered adventure " + adventure.id + " as recent"))
      .catch(e => analyticsContext.logError("Failed to register adventure " + adventure.id + " as recent", e));
  }, [analyticsContext, userContext, adventure]);

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
    if (props.adventureId) {
      setCreateInviteButtonDisabled(false);
    }
  }, [props.adventureId, setCreateInviteButtonDisabled]);

  // Invitations
  const [inviteLink, setInviteLink] = useState<string | undefined>(undefined);
  const createInviteLink = useCallback(() => {
    if (adventure === undefined || userContext.functionsService === undefined) {
      return;
    }

    setCreateInviteButtonDisabled(true);
    analyticsContext.analytics?.logEvent("share", { "content_type": "adventure", "item_id": props.adventureId });
    userContext.functionsService.inviteToAdventure(adventure.id)
      .then(l => setInviteLink(props.adventureId + "/invite/" + l))
      .catch(e => {
        setCreateInviteButtonDisabled(false);
        analyticsContext.logError("Failed to create invite link for " + props.adventureId, e);
      });
  }, [adventure, analyticsContext, props.adventureId, setCreateInviteButtonDisabled, setInviteLink, userContext]);

  // Adventure editing support
  const [players, setPlayers] = useState<IPlayer[]>([]);
  useEffect(() => {
    if (userContext.dataService === undefined) {
      setPlayers([]);
      return () => {};
    }

    return userContext.dataService.watchPlayers(
      props.adventureId,
      setPlayers,
      e => analyticsContext.logError("Failed to watch players of adventure " + props.adventureId, e)
    );
  }, [analyticsContext, userContext.dataService, props.adventureId]);

  const playersTitle = useMemo(() => {
    if (adventure?.record.owner !== userContext.user?.uid) {
      return "Players";
    }
    
    return "Players (" + players.filter(p => p.allowed !== false).length + "/" + (userPolicy?.players ?? 0) + ")";
  }, [adventure, players, userContext, userPolicy]);

  const canEditAdventure = useMemo(
    () => adventure?.record.owner === userContext.user?.uid,
    [userContext.user, adventure]
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

  // Adventure deletion support
  const canDeleteAdventure = useMemo(
    () => canEditAdventure && adventure?.record.maps.length === 0,
    [canEditAdventure, adventure]
  );
  const cannotDeleteAdventure = useMemo(() => canDeleteAdventure === false, [canDeleteAdventure]);
  const [showDeleteAdventure, setShowDeleteAdventure] = useState(false);

  // Support for leaving the adventure
  const canLeaveAdventure = useMemo(
    () => adventure?.record.owner !== userContext.user?.uid,
    [userContext.user, adventure]
  );
  const [showLeaveAdventure, setShowLeaveAdventure] = useState(false);

  // Support for the players list
  const ownerUid = useMemo(() => adventure?.record.owner, [adventure]);
  const showBlockButtons = useMemo(() => ownerUid === userContext.user?.uid, [ownerUid, userContext.user]);
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
    setShowImagePicker(false);
    setShowDeleteAdventure(false);
    setShowLeaveAdventure(false);
  }, [setShowBlockPlayer, setShowUnblockPlayer, setShowEditAdventure, setShowImagePicker, setShowDeleteAdventure, setShowLeaveAdventure]);

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

    const playerRef = userContext.dataService?.getPlayerRef(props.adventureId, playerToBlock.playerId);
    if (playerRef !== undefined) {
      userContext.dataService?.update(playerRef, { allowed: allowed })
        .catch(e => analyticsContext.logError("Failed to block/unblock player", e));
    }
  }, [analyticsContext, handleModalClose, playerToBlock, props.adventureId, userContext.dataService]);

  const handleShowEditAdventure = useCallback(() => {
    if (adventure === undefined) {
      return;
    }

    setEditAdventureName(adventure.record.name);
    setEditAdventureDescription(adventure.record.description);
    setShowEditAdventure(true);
  }, [adventure, setEditAdventureName, setEditAdventureDescription, setShowEditAdventure]);

  const handleShowImagePicker = useCallback(() => {
    if (adventure === undefined) {
      return;
    }

    setShowImagePicker(true);
  }, [adventure, setShowImagePicker]);

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
      userContext.dataService, userContext.user?.uid, summariseAdventure(props.adventureId, updated), updated
    );
  }, [userContext, props.adventureId, adventure, editAdventureName, editAdventureDescription, handleModalClose]);

  const handleImagePickerSave = useCallback((path: string | undefined) => {
    handleModalClose();
    if (adventure === undefined) {
      return;
    }

    const updated = { ...adventure.record, imagePath: path ?? "" };
    editAdventure(
      userContext.dataService, userContext.user?.uid, summariseAdventure(props.adventureId, updated), updated
    )
      .then(() => console.log(`Adventure ${props.adventureId} successfully edited`))
      .catch(e => analyticsContext.logError(`Error editing adventure ${props.adventureId}`, e));
  }, [adventure, analyticsContext, handleModalClose, props.adventureId, userContext]);

  const handleDeleteAdventureSave = useCallback(() => {
    handleModalClose();
    deleteAdventure(userContext.dataService, userContext.user?.uid, props.adventureId)
      .then(() => {
        console.log("Adventure " + props.adventureId + " successfully deleted");
        history.replace("/");
      })
      .catch(e => analyticsContext.logError("Error deleting adventure " + props.adventureId, e));
  }, [userContext, props.adventureId, history, handleModalClose, analyticsContext]);

  const handleLeaveAdventureSave = useCallback(() => {
    handleModalClose();
    leaveAdventure(userContext.dataService, userContext.user?.uid, props.adventureId)
      .then(() => {
        console.log("Successfully left adventure " + props.adventureId);
        history.replace("/");
      })
      .catch(e => analyticsContext.logError("Error leaving adventure " + props.adventureId, e));
  }, [userContext, analyticsContext, props.adventureId, handleModalClose, history]);

  const maps = useMemo(() => adventure?.record.maps ?? [], [adventure]);
  const mapDelete = useCallback((id: string) => {
    deleteMap(userContext.dataService, userContext.user?.uid, props.adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => analyticsContext.logError("Error deleting map " + id, e));
  }, [userContext, props.adventureId, analyticsContext]);

  // TODO #149: Super temporary place to put an image selection thingy, in that button group there
  // TODO #149 Make the card here have the image if there is one.
  return (
    <div>
      <Navigation>{title}</Navigation>
      <Container>
        {adventure !== undefined ?
          <Row className="mt-4">
            <Col>
              <CardDeck>
                <Card bg="dark" text="white">
                  <Card.Header className="card-header-spaced">
                    {adventure.record.name}
                    {canEditAdventure === true ?
                      <ButtonGroup className="ml-2">
                        <Button variant="primary" onClick={handleShowEditAdventure}>Edit</Button>
                        <Button variant="primary" onClick={handleShowImagePicker}>
                          <FontAwesomeIcon icon={faImage} color="white" />
                        </Button>
                      </ButtonGroup> :
                      <div></div>
                    }
                  </Card.Header>
                  <Card.Body>
                    <Card.Text>{adventure.record.description}</Card.Text>
                  </Card.Body>
                  <Card.Footer className="card-footer-spaced">
                    {canEditAdventure !== true ? <div></div> : inviteLink === undefined ?
                      <Button variant="primary" disabled={createInviteButtonDisabled} onClick={createInviteLink}>{createInviteText}</Button> :
                      <Link to={inviteLink}>Send this link to other players to invite them.</Link>
                    }
                    {canEditAdventure === true ?
                      <Button variant="danger" onClick={() => setShowDeleteAdventure(true)}>Delete adventure</Button> :
                      canLeaveAdventure === true ? <Button variant="warning" onClick={() => setShowLeaveAdventure(true)}>Leave adventure</Button> :
                        <div></div>
                    }
                  </Card.Footer>
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
              deleteMap={mapDelete} />
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
        handleSave={handleImagePickerSave} />
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