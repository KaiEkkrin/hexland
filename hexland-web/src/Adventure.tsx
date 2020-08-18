import React, { useContext, useEffect, useState, useMemo } from 'react';
import './App.css';

import { FirebaseContext } from './components/FirebaseContextProvider';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure } from './data/adventure';
import { MapType } from './data/map';
import { IIdentified } from './data/identified';
import { deleteMap, editMap, registerAdventureAsRecent, inviteToAdventure } from './services/extensions';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { Link, RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IAdventureProps {
  adventureId: string;
}

function Adventure(props: IAdventureProps) {
  const firebaseContext = useContext(FirebaseContext);
  const userContext = useContext(UserContext);

  const [adventure, setAdventure] = useState<IIdentified<IAdventure> | undefined>(undefined);
  useEffect(() => {
    var d = userContext.dataService?.getAdventureRef(props.adventureId);
    if (d === undefined) {
      return;
    }

    return userContext.dataService?.watch(d,
      a => setAdventure(a === undefined ? undefined : { id: props.adventureId, record: a }),
      e => console.error("Error watching adventure " + props.adventureId + ": ", e));
  }, [userContext.dataService, props.adventureId]);

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

    inviteToAdventure(
      userContext.dataService,
      firebaseContext.timestampProvider,
      summariseAdventure(adventure.id, adventure.record)
    )
      .then(l => setInviteLink(props.adventureId + "/invite/" + l))
      .catch(e => console.error("Failed to create invite link for " + props.adventureId, e));
  }

  // Map editing support
  const mapsEditable = useMemo(
    () => adventure?.record.owner === userContext.user?.uid,
    [userContext.user, adventure]
  );
  const maps = useMemo(() => adventure?.record.maps ?? [], [adventure]);

  function setMap(adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) {
    const isNew = id === undefined;
    const updated = {
      adventureId: adventureId,
      id: id ?? uuidv4(),
      name: name,
      description: description,
      ty: ty
    };

    editMap(userContext.dataService, adventureId, isNew, updated)
      .then(() => console.log("Map " + updated.id + " successfully updated"))
      .catch(e => console.error("Error editing map " + updated.id, e));
  }

  function mapDelete(id: string) {
    deleteMap(userContext.dataService, props.adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => console.error("Error deleting map " + id, e));
  }

  return (
    <div>
      <Navigation title={adventure?.record.name} />
      <Container fluid>
        {adventure !== undefined ?
          <Row className="mt-4">
            <Col>
              <Card bg="dark" text="white">
                <Card.Body>
                  <Card.Text>{adventure.record.description}</Card.Text>
                </Card.Body>
                <Card.Footer>
                  {inviteLink === undefined ?
                    <Button variant="primary" onClick={createInviteLink}>Create invite link</Button> :
                    <Link to={inviteLink}>Send this link to other players to invite them.</Link>
                  }
                </Card.Footer>
              </Card>
            </Col>
          </Row>
          : <div></div>
        }
        <Row className="mt-4">
          <Col>
            <MapCollection editable={mapsEditable}
              showAdventureSelection={false}
              adventures={adventures}
              maps={maps}
              setMap={setMap} deleteMap={mapDelete} />
          </Col>
        </Row>
      </Container>
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