import React, { useContext, useEffect, useState } from 'react';
import './App.css';

import { UserContext } from './App';
import AdventureCollection from './components/AdventureCollection';
import Navigation from './components/Navigation';

import { IPlayer } from './data/adventure';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function Shared() {
  const userContext = useContext(UserContext);
  const [adventures, setAdventures] = useState<IPlayer[]>([]);

  useEffect(() => {
    userContext.dataService?.watchSharedAdventures(
      a => {
        console.log("Received " + a.length + " shared adventures");
        setAdventures(a.filter(a2 => a2.playerId !== a2.owner));
      },
      e => console.error("Error watching shared adventures: ", e)
    );
  }, [userContext.dataService]);

  return (
    <div>
      <Navigation title={"Adventures shared with me"} />
      <Container fluid>
        <Row>
          <Col>
            <AdventureCollection uid={userContext.user?.uid}
              adventures={adventures} setAdventure={undefined} />
          </Col>
        </Row>
      </Container>
    </div>
  );
}

function SharedPage() {
  const userContext = useContext(UserContext);
  return userContext.user === undefined ? <div></div> : <Shared></Shared>;
}

export default SharedPage;