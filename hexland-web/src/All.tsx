import React, { useContext, useState, useEffect, useMemo } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { editAdventure } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';
import { RequireLoggedIn } from './components/RequireLoggedIn';

function All() {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);

  const [adventures, setAdventures] = useState<IIdentified<IAdventure>[]>([]);

  // Watch all adventures
  useEffect(() => {
    return userContext.dataService?.watchAdventures(
      a => setAdventures(a),
      e => console.error("Error watching adventures: ", e)
    );
  }, [userContext.dataService]);

  // Keep summaries of them
  const adventureSummaries = useMemo(
    () => adventures.map(a => summariseAdventure(a.id, a.record)),
    [adventures]
  );

  function createAdventure(name: string, description: string) {
    const uid = userContext.user?.uid;
    if (uid === undefined) {
      return;
    }

    const record = {
      id: uuidv4(),
      name: name,
      description: description,
      owner: uid,
      ownerName: profile?.name ?? "Unknown user"
    };

    editAdventure(userContext.dataService, true, record)
      .then(() => console.log("Adventure " + record.id + " successfully created"))
      .catch(e => console.error("Error creating adventure " + record.id, e));
  }

  return (
    <RequireLoggedIn>
      <Navigation title={"All adventures"}/>
      <Container>
        <Row>
          <Col>
            <AdventureCollection uid={userContext.user?.uid}
              adventures={adventureSummaries} createAdventure={createAdventure} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default All;