import { useContext, useEffect, useMemo } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContext';
import { UserContext } from './components/UserContext';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import { useNavigate } from 'react-router-dom';

function Home() {
  const { user } = useContext(UserContext);
  const { profile } = useContext(ProfileContext);
  const navigate = useNavigate();

  // Redirect to login if not logged in
  useEffect(() => {
    if (user === null) {
      navigate('/login');
    }
  }, [user, navigate]);

  const myAdventures = useMemo(
    () => profile?.adventures?.filter(a => a.owner === user?.uid) ?? [],
    [profile, user]
  );

  const showNewMap = useMemo(() => myAdventures.length > 0, [myAdventures]);
  const adventures = useMemo(() => profile?.adventures ?? [], [profile]);
  const latestMaps = useMemo(() => profile?.latestMaps ?? [], [profile]);

  return (
    <div>
      <Navigation />
      <Container>
        <Row>
          <Col>
            <h5 className="mt-4">Latest maps</h5>
            <MapCollection
              adventures={myAdventures}
              maps={latestMaps}
              showNewMap={showNewMap}
            />
          </Col>
        </Row>
        <Row>
          <Col>
            <h5 className="mt-4">Latest adventures</h5>
            <AdventureCollection
              uid={user?.uid}
              adventures={adventures}
              showNewAdventure={true}
            />
          </Col>
        </Row>
      </Container>
    </div>
  );
}

export default Home;