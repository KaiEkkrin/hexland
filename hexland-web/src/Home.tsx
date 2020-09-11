import React, { useContext, useMemo } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Introduction from './components/Introduction';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IMap } from './data/map';
import { editAdventure, editMap } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';

function LatestColumn() {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);

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
      .catch(e => analyticsContext.logError("Error creating adventure " + record.id, e));
  };

  function setMap(adventureId: string, id: string | undefined, map: IMap) {
    id = id ?? uuidv4();
    editMap(userContext.dataService, adventureId, id, map)
      .then(() => console.log("Map " + id + " successfully updated"))
      .catch(e => analyticsContext.logError("Error editing map " + id, e));
  }

  return (
    <div>
      <h5 className="mt-4">Latest maps</h5>
      <MapCollection
        adventures={myAdventures}
        maps={latestMaps}
        setMap={setMap} />
      <h5 className="mt-4">Latest adventures</h5>
      <AdventureCollection
        uid={userContext.user?.uid}
        adventures={adventures} createAdventure={createAdventure} />
    </div>
  );
}

function Home() {
  const userContext = useContext(UserContext);

  // If we're logged in, we show both the introduction and our latest maps and adventures
  // in side-by-side columns.  Otherwise, we show just the introduction.
  const columns = useMemo(() => {
    const columnArray = [
      <Col key="intro">
        <Introduction />
      </Col>
    ];

    if (userContext.user) {
      columnArray.splice(0, 0,
        <Col key="latest" xl={{ order: 'last' }}
          lg={{ order: 'last', span: 4 }}
          md={{ order: 'first', span: 12 }}
          sm={{ order: 'first', span: 12 }}
          xs={{ order: 'first', span: 12 }}>
          <LatestColumn />
        </Col >
      );
    }

    return columnArray;
  }, [userContext.user]);

  // Changing the container fluidity lets us take up more of the screen when we have two
  // TODO On narrower screens, make the latest column collapse into a side bar instead,
  // with a pull-out to expand it to the whole window and disappear the introduction?
  const containerFluid = useMemo(() => userContext.user ? true : undefined, [userContext.user]);

  return (
    <div>
      <Navigation title={undefined} />
      <Container fluid={containerFluid}>
        <Row>
          {columns}
        </Row>
      </Container>
    </div>
  );
}

export default Home;