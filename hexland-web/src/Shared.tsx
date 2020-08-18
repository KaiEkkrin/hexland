import React, { useContext, useEffect, useState } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import Navigation from './components/Navigation';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IPlayer } from './data/adventure';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function Shared() {
  const userContext = useContext(UserContext);
  const [adventures, setAdventures] = useState<IPlayer[]>([]);

  useEffect(() => {
    return userContext.dataService?.watchSharedAdventures(
      a => {
        console.log("Received " + a.length + " shared adventures");
        setAdventures(a.filter(a2 => a2.playerId !== a2.owner));
      },
      e => console.error("Error watching shared adventures: ", e)
    );
  }, [userContext.dataService]);

  return (
    <RequireLoggedIn>
      <Navigation title={"Adventures shared with me"} />
      <Container fluid>
        <Row>
          <Col>
            <AdventureCollection uid={userContext.user?.uid}
              adventures={adventures} setAdventure={undefined} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default Shared;