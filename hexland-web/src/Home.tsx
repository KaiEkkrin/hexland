import React from 'react';
import './App.css';

import AdventureCollection from './AdventureCollection';
import { AppContext, AppState } from './App';
import MapCards from './MapCards';
import Navigation from './Navigation';

import { IAdventureSummary, IProfile } from './data/profile';
import { editAdventure } from './services/extensions';
import { IDataService } from './services/interfaces';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';

interface IHomeProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
}

function Home(props: IHomeProps) {
  var setAdventure = function (id: string | undefined, name: string, description: string) {
    if (props.dataService === undefined) {
      return;
    }

    var isNew = id === undefined;
    id = id ?? uuidv4();
    var changed = {
      id: id,
      name: name,
      description: description,
      owner: props.dataService.getUid()
    } as IAdventureSummary;

    editAdventure(props.dataService, isNew, changed)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));
  };

  return (
    <Container>
      <Row className="mt-4">
        <Col>
          <MapCards maps={props.profile?.latestMaps ?? []} editMap={undefined} deleteMap={undefined} />
        </Col>
      </Row>
      <AdventureCollection getAdventures={() => props.profile?.adventures ?? []} setAdventure={setAdventure} />
    </Container>
  );
}

function HomePage() {
  return (
    <div>
      <Navigation getTitle={() => undefined} />
      <AppContext.Consumer>
        {(context: AppState) => context.user === null ? <div></div> : (
          <Home dataService={context.dataService} profile={context.profile} />
        )}
      </AppContext.Consumer>
    </div>
  );
}

export default HomePage;
