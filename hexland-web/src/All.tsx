import React, { useContext, useState, useEffect, useMemo, useCallback } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Navigation from './components/Navigation';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IAdventure, summariseAdventure } from './data/adventure';
import { IIdentified } from './data/identified';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function All() {
  const userContext = useContext(UserContext);
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
      e => analyticsContext.logError("Error watching adventures: ", e)
    );
  }, [analyticsContext, userContext]);

  // Keep summaries of them
  const adventureSummaries = useMemo(
    () => adventures.map(a => summariseAdventure(a.id, a.record)),
    [adventures]
  );

  const createAdventure = useCallback((name: string, description: string) => {
    const functionsService = userContext.functionsService;
    if (functionsService === undefined) {
      return;
    }

    functionsService.createAdventure(name, description)
      .then(id => console.log("Adventure " + id + " successfully created"))
      .catch(e => analyticsContext.logError("Error creating adventure", e));
  }, [userContext, analyticsContext]);

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