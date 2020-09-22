import React, { useContext, useEffect, useState, useMemo, useCallback } from 'react';
import './App.css';

import AdventureModal from './components/AdventureModal';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { FirebaseContext } from './components/FirebaseContextProvider';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import PlayerInfoList from './components/PlayerInfoList';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure, IPlayer } from './data/adventure';
import { IMap } from './data/map';
import { IIdentified } from './data/identified';
import { deleteMap, editMap, registerAdventureAsRecent, inviteToAdventure, editAdventure, deleteAdventure, leaveAdventure, removeAdventureFromRecent } from './services/extensions';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

import { Link, RouteComponentProps, useHistory } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IAdventureProps {
  adventureId: string;
}

function Adventure(props: IAdventureProps) {
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);
  const analyticsContext = useContext(AnalyticsContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    let d = userContext.dataService?.getAdventureRef(props.adventureId);
    if (d === undefined) {
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
    userContext.dataService?.get(d)
      .then(r => {
        if (r === undefined) {
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

  // Invitations
  const [inviteLink, setInviteLink] = useState<string | undefined>(undefined);

  function createInviteLink() {
    if (inviteLink !== undefined || adventure === undefined) {
      return;
    }

    analyticsContext.analytics?.logEvent("share", { "content_type": "adventure", "item_id": props.adventureId });
    inviteToAdventure(
      userContext.dataService,
      firebaseContext.timestampProvider,
      summariseAdventure(adventure.id, adventure.record)
    )
      .then(l => setInviteLink(props.adventureId + "/invite/" + l))
      .catch(e => analyticsContext.logError("Failed to create invite link for " + props.adventureId, e));
  }

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
      e => console.error("Failed to watch players of adventure " + props.adventureId, e)
    );
  }, [userContext.dataService, props.adventureId]);

  const canEditAdventure = useMemo(
    () => adventure?.record.owner === userContext.user?.uid,
    [userContext.user, adventure]
  );

  const [showEditAdventure, setShowEditAdventure] = useState(false);
  const [editAdventureName, setEditAdventureName] = useState("");
  const [editAdventureDescription, setEditAdventureDescription] = useState("");

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

  const handleModalClose = useCallback(() => {
    setShowEditAdventure(false);
    setShowDeleteAdventure(false);
    setShowLeaveAdventure(false);
  }, [setShowEditAdventure, setShowDeleteAdventure, setShowLeaveAdventure]);

  const handleShowEditAdventure = useCallback(() => {
    if (adventure === undefined) {
      return;
    }

    setEditAdventureName(adventure.record.name);
    setEditAdventureDescription(adventure.record.description);
    setShowEditAdventure(true);
  }, [adventure, setEditAdventureName, setEditAdventureDescription, setShowEditAdventure]);

  const handleEditAdventureSave = useCallback(() => {
    handleModalClose();
    if (adventure === undefined) {
      return;
    }

    const updated = {
      ...adventure.record,
      name: editAdventureName,
      description: editAdventureDescription
    };

    editAdventure(
      userContext.dataService, userContext.user?.uid, false, summariseAdventure(props.adventureId, updated), updated
    ).then(() => console.log("Adventure " + props.adventureId + " successfully updated"))
      .catch(e => analyticsContext.logError("Error editing adventure " + props.adventureId, e));
  }, [userContext, props.adventureId, analyticsContext, adventure, editAdventureName, editAdventureDescription, handleModalClose]);

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

  // Map editing support
  // TODO #23 Make this able to create a new map only and consolidate the editing
  // functionality with the map view
  const maps = useMemo(() => adventure?.record.maps ?? [], [adventure]);

  const setMap = useCallback((adventureId: string, id: string | undefined, map: IMap) => {
    id = id ?? uuidv4();
    editMap(userContext.dataService, adventureId, id, map)
      .then(() => console.log("Map " + id + " successfully updated"))
      .catch(e => analyticsContext.logError("Error editing map " + id, e));
  }, [userContext.dataService, analyticsContext]);

  const mapDelete = useCallback((id: string) => {
    deleteMap(userContext.dataService, userContext.user?.uid, props.adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => analyticsContext.logError("Error deleting map " + id, e));
  }, [userContext, props.adventureId, analyticsContext]);

  return (
    <div>
      <Navigation title={adventure?.record.name} />
      <Container>
        {adventure !== undefined ?
          <Row className="mt-4">
            <Col>
              <CardDeck>
                <Card bg="dark" text="white">
                  <Card.Body className="card-body-spaced">
                    <Card.Text>{adventure.record.description}</Card.Text>
                    {canEditAdventure === true ?
                      <Button className="ml-2" variant="primary" onClick={handleShowEditAdventure}>Edit</Button> :
                      <div></div>
                    }
                  </Card.Body>
                  <Card.Footer className="card-footer-spaced">
                    {canEditAdventure !== true ? <div></div> : inviteLink === undefined ?
                      <Button variant="primary" onClick={createInviteLink}>Create invite link</Button> :
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
                  <Card.Header>Players</Card.Header>
                  <PlayerInfoList ownerUid={ownerUid} players={players} tokens={[]} />
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
              setMap={setMap} deleteMap={mapDelete} />
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
      <Modal show={showDeleteAdventure} onHide={handleModalClose}>
        <Modal.Header>
          <Modal.Title>Delete adventure</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {canDeleteAdventure ? <p>Do you really want to delete this adventure?</p> :
          <p>Adventures with maps cannot be deleted.</p>}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
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
          <Button variant="secondary" onClick={handleModalClose}>Close</Button>
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