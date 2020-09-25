import React, { useContext, useEffect, useState } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Navigation from './components/Navigation';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IPlayer } from './data/adventure';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function Shared() {
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const [adventures, setAdventures] = useState<IPlayer[]>([]);

  useEffect(() => {
    const uid = userContext.user?.uid;
    if (uid === undefined) {
      return undefined;
    }

    return userContext.dataService?.watchSharedAdventures(
      uid,
      a => {
        console.log("Received " + a.length + " shared adventures");
        setAdventures(a.filter(a2 => a2.playerId !== a2.owner && a2.allowed !== false));
      },
      e => analyticsContext.logError("Error watching shared adventures: ", e)
    );
  }, [analyticsContext, userContext]);

  return (
    <RequireLoggedIn>
      <Navigation title={"Adventures shared with me"} />
      <Container>
        <Row>
          <Col>
            <AdventureCollection uid={userContext.user?.uid}
              adventures={adventures} createAdventure={undefined} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default Shared;