import React, { useContext, useEffect, useState, useMemo } from 'react';
import './App.css';

import AdventureModal from './components/AdventureModal';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { FirebaseContext } from './components/FirebaseContextProvider';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import PlayerInfoList from './components/PlayerInfoList';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure, IPlayer } from './data/adventure';
import { IMap } from './data/map';
import { IIdentified } from './data/identified';
import { deleteMap, editMap, registerAdventureAsRecent, inviteToAdventure, editAdventure, deleteAdventure, leaveAdventure } from './services/extensions';

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
  const profileContext = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);

  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    var d = userContext.dataService?.getAdventureRef(props.adventureId);
    if (d === undefined) {
      return;
    }

    analyticsContext.analytics?.logEvent("select_content", {
      "content_type": "adventure",
      "item_id": props.adventureId
    });
    return userContext.dataService?.watch(d,
      a => setAdventure(a === undefined ? undefined : { id: props.adventureId, record: a }),
      e => console.error("Error watching adventure " + props.adventureId + ": ", e));
  }, [userContext.dataService, analyticsContext.analytics, props.adventureId]);

  // Track changes to the adventure
  useEffect(() => {
    if (userContext.dataService === undefined || adventure === undefined) {
      return;
    }

    registerAdventureAsRecent(userContext.dataService, adventure.id, adventure.record)
      .then(() => console.log("registered adventure " + adventure.id + " as recent"))
      .catch(e => console.error("Failed to register adventure " + adventure.id + " as recent", e));
  }, [userContext.dataService, adventure]);

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
      .catch(e => console.error("Failed to create invite link for " + props.adventureId, e));
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
  const history = useHistory();

  // Support for leaving the adventure
  const canLeaveAdventure = useMemo(
    () => adventure?.record.owner !== userContext.user?.uid,
    [userContext.user, adventure]
  );
  const [showLeaveAdventure, setShowLeaveAdventure] = useState(false);

  // Support for the players list
  const ownerUid = useMemo(() => adventure?.record.owner, [adventure]);

  function handleModalClose() {
    setShowEditAdventure(false);
    setShowDeleteAdventure(false);
    setShowLeaveAdventure(false);
  }

  function handleShowEditAdventure() {
    if (adventure === undefined) {
      return;
    }

    setEditAdventureName(adventure.record.name);
    setEditAdventureDescription(adventure.record.description);
    setShowEditAdventure(true);
  }

  function handleEditAdventureSave() {
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
      userContext.dataService, false, summariseAdventure(props.adventureId, updated), updated
    ).then(() => console.log("Adventure " + props.adventureId + " successfully updated"))
      .catch(e => console.error("Error editing adventure " + props.adventureId, e));
  }

  function handleDeleteAdventureSave() {
    handleModalClose();
    deleteAdventure(userContext.dataService, props.adventureId)
      .then(() => {
        console.log("Adventure " + props.adventureId + " successfully deleted");
        history.replace("/");
      })
      .catch(e => console.error("Error deleting adventure " + props.adventureId, e));
  }

  function handleLeaveAdventureSave() {
    handleModalClose();
    leaveAdventure(userContext.dataService, profileContext, props.adventureId)
      .then(() => {
        console.log("Successfully left adventure " + props.adventureId);
        history.replace("/");
      })
      .catch(e => console.error("Error leaving adventure " + props.adventureId, e));
  }

  // Map editing support
  // TODO #23 Make this able to create a new map only and consolidate the editing
  // functionality with the map view
  const maps = useMemo(() => adventure?.record.maps ?? [], [adventure]);

  function setMap(adventureId: string, id: string | undefined, map: IMap) {
    id = id ?? uuidv4();
    editMap(userContext.dataService, adventureId, id, map)
      .then(() => console.log("Map " + id + " successfully updated"))
      .catch(e => console.error("Error editing map " + id, e));
  }

  function mapDelete(id: string) {
    deleteMap(userContext.dataService, props.adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => console.error("Error deleting map " + id, e));
  }

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