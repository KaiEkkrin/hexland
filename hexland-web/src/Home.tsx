import React from 'react';
import './App.css';

import { AppContext, AppState } from './App';
import AdventureCollection from './components/AdventureCollection';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';

import { IMapSummary } from './data/adventure';
import { IAdventureSummary, IProfile } from './data/profile';
import { editAdventure, editMap } from './services/extensions';
import { IDataService } from './services/interfaces';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';
import { MapType } from './data/map';

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
      owner: props.dataService.getUid(),
      ownerName: props.profile?.name ?? "Unknown user"
    } as IAdventureSummary;

    editAdventure(props.dataService, isNew, changed)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));
  };

  var setMap = function (adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) {
    if (props.dataService === undefined) {
      return;
    }

    if (id !== undefined) { // We don't support editing from here
      return;
    }

    var newMap = {
      adventureId: adventureId,
      id: uuidv4(),
      name: name,
      description: description,
      ty: ty,
    } as IMapSummary;
    editMap(props.dataService, adventureId, true, newMap)
      .then(() => console.log("Map " + newMap.id + " successfully added"))
      .catch(e => console.error("Error adding map " + newMap.id, e));
  }

  return (
    <Container fluid>
      <Row>
        <Col xl>
          <h5 className="mt-4">Latest maps</h5>
          <MapCollection editable={false}
            showAdventureSelection={true}
            getAdventures={() => props.profile?.adventures?.filter(a => a.owner === props.dataService?.getUid()) ?? []}
            getMaps={() => props.profile?.latestMaps ?? []}
            setMap={setMap} deleteMap={undefined} />
        </Col>
        <Col xl>
          <h5 className="mt-4">Latest adventures</h5>
          <AdventureCollection
            uid={props.dataService?.getUid()}
            getAdventures={() => props.profile?.adventures ?? []} setAdventure={setAdventure} />
        </Col>
      </Row>
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
