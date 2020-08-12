import React, { useContext } from 'react';
import './App.css';

import { ProfileContext, UserContext } from './App';
import AdventureCollection from './components/AdventureCollection';
import MapCollection from './components/MapCollection';
import Navigation from './components/Navigation';

import { IMapSummary } from './data/adventure';
import { IAdventureSummary } from './data/profile';
import { editAdventure, editMap } from './services/extensions';

import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { v4 as uuidv4 } from 'uuid';
import { MapType } from './data/map';

function Home() {
  var userContext = useContext(UserContext);
  var profile = useContext(ProfileContext);

  var setAdventure = function (id: string | undefined, name: string, description: string) {
    if (userContext.dataService === undefined) {
      return;
    }

    var isNew = id === undefined;
    id = id ?? uuidv4();
    var changed = {
      id: id,
      name: name,
      description: description,
      owner: userContext.dataService.getUid(),
      ownerName: profile?.name ?? "Unknown user"
    } as IAdventureSummary;

    editAdventure(userContext.dataService, isNew, changed)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));
  };

  var setMap = function (adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) {
    if (userContext.dataService === undefined) {
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
    editMap(userContext.dataService, adventureId, true, newMap)
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
            getAdventures={() => profile?.adventures?.filter(a => a.owner === userContext.dataService?.getUid()) ?? []}
            getMaps={() => profile?.latestMaps ?? []}
            setMap={setMap} deleteMap={undefined} />
        </Col>
        <Col xl>
          <h5 className="mt-4">Latest adventures</h5>
          <AdventureCollection
            uid={userContext.dataService?.getUid()}
            getAdventures={() => profile?.adventures ?? []} setAdventure={setAdventure} />
        </Col>
      </Row>
    </Container>
  );
}

function HomePage() {
  var userContext = useContext(UserContext);
  return (
    <div>
      <Navigation getTitle={() => undefined} />
      {userContext.user === null ? <div></div> : <Home />}
    </div>
  );
}

export default HomePage;
