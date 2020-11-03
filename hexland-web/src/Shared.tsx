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
  const { logError } = useContext(AnalyticsContext);
  const { dataService, user } = useContext(UserContext);
  const [adventures, setAdventures] = useState<IPlayer[]>([]);

  useEffect(() => {
    const uid = user?.uid;
    if (uid === undefined) {
      return undefined;
    }

    return dataService?.watchSharedAdventures(
      uid,
      a => {
        console.log("Received " + a.length + " shared adventures");
        setAdventures(a.filter(a2 => a2.playerId !== a2.owner && a2.allowed !== false));
      },
      e => logError("Error watching shared adventures: ", e)
    );
  }, [logError, dataService, user]);

  return (
    <RequireLoggedIn>
      <Navigation>
        Adventures shared with me
      </Navigation>
      <Container>
        <Row>
          <Col className="mt-4">
            <h5>Adventures shared with me</h5>
            <AdventureCollection uid={user?.uid}
              adventures={adventures} showNewAdventure={false} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default Shared;