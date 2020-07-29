import React from 'react';
import './App.css';

import AdventureCards from './AdventureCards';
import { AppContext, AppState } from './App';
import Navigation from './Navigation';

import { IProfile } from './data/profile';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

interface IHomeProps {
  profile: IProfile | undefined;
}

function Home(props: IHomeProps) {
  return (
    <Container>
      <Row>
        <Col>
          <AdventureCards adventures={props.profile?.adventures ?? []} editAdventure={undefined} />
        </Col>
      </Row>
    </Container>
  );
}

interface IHomePageProps {}

function HomePage(props: IHomePageProps) {
  return (
    <div>
      <Navigation />
      <AppContext.Consumer>
        {(context: AppState) => context.user === null ? <p>Log in button TODO</p> : (
          <Home profile={context.profile} />
        )}
      </AppContext.Consumer>
    </div>
  );
}

export default HomePage;
