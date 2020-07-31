import React from 'react';
import './App.css';

import AdventureCollection from './AdventureCollection';
import { AppContext, AppState } from './App';
import MapCollection from './MapCollection';
import Navigation from './Navigation';

import { MapType } from './data/map';
import { IAdventureSummary, IProfile } from './data/profile';
import { editAdventure } from './services/extensions';
import { IDataService } from './services/interfaces';

import Container from 'react-bootstrap/Container';

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

  var setMap = function (id: string | undefined, name: string, description: string, ty: MapType) {
    // TODO Handle creating a new map directly from the home page, with an adventure dropdown.
  }

  return (
    <Container>
      <MapCollection editable={false} getMaps={() => props.profile?.latestMaps ?? []} setMap={setMap} deleteMap={undefined} />
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
