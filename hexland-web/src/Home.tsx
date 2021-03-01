import { useContext, useMemo, useReducer } from 'react';
import * as React from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import ChangeList from './components/ChangeList';
import Introduction from './components/Introduction';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { UserContext } from './components/UserContextProvider';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function LatestColumn() {
  const { user } = useContext(UserContext);
  const { profile } = useContext(ProfileContext);

  const myAdventures = useMemo(
    () => profile?.adventures?.filter(a => a.owner === user?.uid) ?? [],
    [profile, user]
  );

  const showNewMap = useMemo(() => myAdventures.length > 0, [myAdventures]);
  const adventures = useMemo(() => profile?.adventures ?? [], [profile]);
  const latestMaps = useMemo(() => profile?.latestMaps ?? [], [profile]);

  return (
    <div>
      <h5 className="mt-4">Latest maps</h5>
      <MapCollection
        adventures={myAdventures}
        maps={latestMaps}
        showNewMap={showNewMap}
        />
      <h5 className="mt-4">Latest adventures</h5>
      <AdventureCollection
        uid={user?.uid}
        adventures={adventures} showNewAdventure={true} />
    </div>
  );
}

function Home() {
  const { user } = useContext(UserContext);

  // We keep the change list state here
  const [changeCount, toggleChangeCount] = useReducer(
    (state: number | undefined, action: void) => state === undefined ? 1 : undefined,
    1
  );

  // If we're logged in, we show both the introduction and our latest maps and adventures
  // in side-by-side columns.  Otherwise, we show just the introduction.
  const columns = useMemo(() => {
    const columnArray = [
      <Col key="intro">
        <ChangeList count={changeCount} toggleCount={() => toggleChangeCount()} />
        <Introduction />
      </Col>
    ];

    if (user) {
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
  }, [changeCount, toggleChangeCount, user]);

  // Changing the container fluidity lets us take up more of the screen when we have two
  // TODO On narrower screens, make the latest column collapse into a side bar instead,
  // with a pull-out to expand it to the whole window and disappear the introduction?
  const containerFluid = useMemo(() => user ? true : undefined, [user]);

  return (
    <div>
      <Navigation />
      <Container fluid={containerFluid}>
        <Row>
          {columns}
        </Row>
      </Container>
    </div>
  );
}

export default Home;