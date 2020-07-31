import React from 'react';
import './App.css';

import { AppContext, AppState } from './App';
import MapCollection from './MapCollection';
import Navigation from './Navigation';

import { IMapSummary, IAdventure } from './data/adventure';
import { IProfile, IAdventureSummary } from './data/profile';
import { deleteMap, editMap, registerAdventureAsRecent } from './services/extensions';
import { IDataService } from './services/interfaces';

import Card from 'react-bootstrap/Card';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';
import { MapType } from './data/map';

interface IAdventureProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
  adventureId: string;
}

class AdventureState {
  adventure: IAdventure | undefined = undefined;
}

class Adventure extends React.Component<IAdventureProps, AdventureState> {
  private _stopWatchingAdventure: (() => void) | undefined;

  constructor(props: IAdventureProps) {
    super(props);
    this.state = new AdventureState();

    this.getAdventures = this.getAdventures.bind(this);
    this.setMap = this.setMap.bind(this);
    this.deleteMap = this.deleteMap.bind(this);
  }

  private getAdventures(): IAdventureSummary[] {
    return this.state.adventure === undefined ? [] : [{
      id: this.props.adventureId,
      name: this.state.adventure.name,
      description: this.state.adventure.description,
      owner: this.state.adventure.owner
    }];
  }

  private setMap(adventureId: string, id: string | undefined, name: string, description: string, ty: MapType) {
    var uid = this.props.dataService?.getUid();
    if (uid === undefined) {
      return;
    }

    var isNew = id === undefined;
    var updated = {
      id: id ?? uuidv4(),
      name: name,
      description: description,
      owner: uid,
      ty: ty
    } as IMapSummary;

    editMap(this.props.dataService, adventureId, isNew, updated)
      .then(() => console.log("Map " + updated.id + " successfully edited"))
      .catch(e => console.error("Error editing map " + updated.id, e));
  }

  private deleteMap(id: string) {
    deleteMap(this.props.dataService, this.props.adventureId, id)
      .then(() => console.log("Map " + id + " successfully deleted"))
      .catch(e => console.error("Error deleting map " + id, e));
  }

  private watchAdventure() {
    this._stopWatchingAdventure?.();
    this._stopWatchingAdventure = this.props.dataService?.watchAdventure(
      this.props.adventureId,
      a => this.setState({ adventure: a }),
      e => console.error("Error watching adventure " + this.props.adventureId + ":", e)
    );
  }

  componentDidMount() {
    this.watchAdventure();
  }

  componentDidUpdate(prevProps: IAdventureProps, prevState: AdventureState) {
    if (this.props.dataService !== prevProps.dataService || this.props.adventureId !== prevProps.adventureId) {
      this.watchAdventure();
    }

    if (this.state.adventure !== undefined && this.state.adventure !== prevState.adventure) {
      registerAdventureAsRecent(this.props.dataService, this.props.profile, {
        id: this.props.adventureId,
        name: this.state.adventure.name,
        description: this.state.adventure.description,
        owner: this.state.adventure.owner,
      })
      .catch(e => console.error("Failed to register " + this.props.adventureId + " as recent", e));
    }
  }

  componentWillUnmount() {
    this._stopWatchingAdventure?.();
    this._stopWatchingAdventure = undefined;
  }

  render() {
    return (
      <div>
        <Navigation getTitle={() => this.state.adventure?.name} />
        <Container fluid>
          {this.state.adventure !== undefined ?
            <Row className="mt-4">
              <Col>
                <Card bg="dark" text="white">
                  <Card.Body>
                    <Card.Text>{this.state.adventure.description}</Card.Text>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
            : <div></div>
          }
          <Row className="mt-4">
            <Col>
              <MapCollection editable={true} showAdventureSelection={false}
                getAdventures={this.getAdventures}
                getMaps={() => this.state.adventure?.maps ?? []}
                setMap={this.setMap} deleteMap={this.deleteMap} />
            </Col>
          </Row>
        </Container>
      </div>
    );
  }
}

interface IAdventurePageProps {
  adventureId: string;
}

function AdventurePage(props: RouteComponentProps<IAdventurePageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <Adventure dataService={context.dataService} profile={context.profile}
          adventureId={props.match.params.adventureId} />
      )}
    </AppContext.Consumer>
  )
}

export default AdventurePage;