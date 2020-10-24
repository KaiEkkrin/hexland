import React, { useContext, useState, useEffect, useMemo } from 'react';
import './App.css';

import AdventureCollection from './components/AdventureCollection';
import { AnalyticsContext } from './components/AnalyticsContextProvider';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IPageProps } from './components/interfaces';
import { IAdventure, summariseAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { getUserPolicy } from './data/policy';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

function All({ navbarTitle, setNavbarTitle }: IPageProps) {
  const { dataService, user } = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);

  const [adventures, setAdventures] = useState<IIdentified<IAdventure>[]>([]);

  const userPolicy = useMemo(
    () => profile === undefined ? undefined : getUserPolicy(profile.level),
    [profile]
  );

  const title = useMemo(
    () => "My adventures (" + adventures.length + "/" + (userPolicy?.adventures ?? 0) + ")",
    [adventures, userPolicy]
  );
  useEffect(() => {
    if (title !== navbarTitle) {
      setNavbarTitle(title);
    }
  }, [navbarTitle, setNavbarTitle, title]);

  // Watch all adventures
  useEffect(() => {
    const uid = user?.uid;
    if (uid === undefined) {
      return () => {};
    }

    return dataService?.watchAdventures(
      uid,
      a => setAdventures(a),
      e => analyticsContext.logError("Error watching adventures: ", e)
    );
  }, [analyticsContext, dataService, user]);

  // I can create a new adventure if I'm not at cap
  const showNewAdventure = useMemo(
    () => adventures.length < (userPolicy?.adventures ?? 0),
    [adventures, userPolicy]
  );

  // Keep summaries of them
  const adventureSummaries = useMemo(
    () => adventures.map(a => summariseAdventure(a.id, a.record)),
    [adventures]
  );

  return (
    <RequireLoggedIn>
      <Container>
        <Row>
          <Col>
            <AdventureCollection uid={user?.uid}
              adventures={adventureSummaries} showNewAdventure={showNewAdventure} />
          </Col>
        </Row>
      </Container>
    </RequireLoggedIn>
  );
}

export default All;