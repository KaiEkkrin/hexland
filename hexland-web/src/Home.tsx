import React, { useContext, useMemo } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IMap } from './data/map';
import { editAdventure, editMap } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';

function Home() {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);

  const myAdventures = useMemo(
    () => profile?.adventures?.filter(a => a.owner === userContext.user?.uid) ?? [],
    [profile, userContext.user]
  );

  const adventures = useMemo(() => profile?.adventures ?? [], [profile]);
  const latestMaps = useMemo(() => profile?.latestMaps ?? [], [profile]);

  function createAdventure(name: string, description: string) {
    if (userContext.dataService === undefined) {
      return;
    }

    const record = {
      id: uuidv4(),
      name: name,
      description: description,
      owner: userContext.dataService.getUid(),
      ownerName: profile?.name ?? "Unknown user"
    };

    editAdventure(userContext.dataService, true, record)
      .then(() => console.log("Adventure " + record.id + " successfully created"))
      .catch(e => console.error("Error creating adventure " + record.id, e));
  };

  function setMap(adventureId: string, id: string | undefined, map: IMap) {
    id = id ?? uuidv4();
    editMap(userContext.dataService, adventureId, id, map)
      .then(() => console.log("Map " + id + " successfully updated"))
      .catch(e => console.error("Error editing map " + id, e));
  }

  return (
    <RequireLoggedIn>
      <Navigation title={undefined} />
      <Container fluid>
        <Row>
          <Col xl>
            <h5 className="mt-4">Latest maps</h5>
            <MapCollection
              adventures={myAdventures}
              maps={latestMaps}
              setMap={setMap} />
          </Col>
          <Col xl>
            <h5 className="mt-4">Latest adventures</h5>
            <AdventureCollection
              uid={userContext.user?.uid}
              adventures={adventures} createAdventure={createAdventure} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default Home;