import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { editAdventure } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';

function All() {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);

  const [adventures, setAdventures] = useState<IIdentified<IAdventure>[]>([]);

  // Watch all adventures
  useEffect(() => {
    const uid = userContext.user?.uid;
    if (uid === undefined) {
      return () => {};
    }

    return userContext.dataService?.watchAdventures(
      uid,
      a => setAdventures(a),
      e => console.error("Error watching adventures: ", e)
    );
  }, [userContext]);

  // Keep summaries of them
  const adventureSummaries = useMemo(
    () => adventures.map(a => summariseAdventure(a.id, a.record)),
    [adventures]
  );

  const createAdventure = useCallback((name: string, description: string) => {
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

    editAdventure(userContext.dataService, uid, true, record)
      .then(() => console.log("Adventure " + record.id + " successfully created"))
      .catch(e => analyticsContext.logError("Error creating adventure " + record.id, e));
  }, [userContext, profile, analyticsContext]);

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