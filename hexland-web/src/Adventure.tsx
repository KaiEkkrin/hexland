import React, { useContext, useEffect, useState, useMemo } from 'react';
import './App.css';

import { FirebaseContext } from './components/FirebaseContextProvider';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure } from './data/adventure';
import { MapType } from './data/map';
import { IAdventureSummary } from './data/profile';
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
  const profile = useContext(ProfileContext);

  const [adventure, setAdventure] = useState<IAdventure | undefined>(undefined);
  const [adventures, setAdventures] = useState<IAdventureSummary[]>([]);

  useEffect(() => {
    var d = userContext.dataService?.getAdventureRef(props.adventureId);
    if (d === undefined) {
      setAdventures([]);
      return;
    }

    return userContext.dataService?.watch(d,
      a => {
        setAdventure(a);

        // Summarise what we have loaded
        setAdventures(a === undefined ? [] : [{
          id: props.adventureId,
          name: a.name,
          description: a.description,
          owner: a.owner,
          ownerName: a.ownerName
        }]);

        // Register it as recent
        if (a !== undefined) {
          registerAdventureAsRecent(userContext.dataService, profile, props.adventureId, a)
            .catch(e => console.error("Failed to register adventure " + props.adventureId + " as recent", e));
        }
      },
      e => console.error("Error watching adventure " + props.adventureId + ": ", e));
  }, [userContext.dataService, profile, props.adventureId]);

  // Invitations
  const [inviteLink, setInviteLink] = useState<string | undefined>(undefined);

  function createInviteLink() {
    if (inviteLink !== undefined || adventure === undefined) {
      return;
    }

    inviteToAdventure(
      userContext.dataService,
      firebaseContext.timestampProvider,
      summariseAdventure(props.adventureId, adventure))
      .then(l => setInviteLink(props.adventureId + "/invite/" + l))
      .catch(e => console.error("Failed to create invite link for " + props.adventureId, e));
  }

  // Map editing support
  const mapsEditable = useMemo(() => adventure?.owner === userContext.user?.uid, [userContext.user, adventure]);
  const maps = useMemo(() => adventure?.maps ?? [], [adventure]);

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
      <Navigation title={adventure?.name} />
      <Container fluid>
        {adventure !== undefined ?
          <Row className="mt-4">
            <Col>
              <Card bg="dark" text="white">
                <Card.Body>
                  <Card.Text>{adventure.description}</Card.Text>
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