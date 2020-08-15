import React, { useContext, useState, useEffect, useMemo } from 'react';
import './App.css';

import { UserContext, ProfileContext } from './App';
import AdventureCollection from './components/AdventureCollection';
import Navigation from './components/Navigation';

import { IAdventure, summariseAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { editAdventure } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { Redirect } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

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

  function setAdventure(id: string | undefined, name: string, description: string) {
    const uid = userContext.user?.uid;
    if (uid === undefined) {
      return;
    }

    const isNew = id === undefined;
    const existing = adventures.find(a => a.id === id)?.record;
    const updated = {
      id: id ?? uuidv4(),
      name: name,
      description: description,
      owner: uid,
      ownerName: profile?.name ?? "Unknown user"
    };

    editAdventure(userContext.dataService, isNew, updated, existing)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));
  }

  return (
    <div>
      <Navigation title={"All adventures"}/>
      <Container fluid>
        <Row>
          <Col>
            <AdventureCollection uid={userContext.user?.uid}
              adventures={adventureSummaries} setAdventure={setAdventure} />
          </Col>
        </Row>
      </Container>
    </div>
  );
}

function AllPage() {
  const userContext = useContext(UserContext);
  return userContext.user === null ? <Redirect to="/login" /> : <All />;
}

export default AllPage;