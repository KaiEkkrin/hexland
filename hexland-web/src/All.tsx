import React from 'react';
import './App.css';

import AdventureCollection from './AdventureCollection';
import { AppContext, AppState } from './App';
import Navigation from './Navigation';

import { IAdventure, SummaryOfAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { IAdventureSummary, IProfile } from './data/profile';
import { editAdventure } from './services/extensions';
import { IDataService } from './services/interfaces';

import Container from 'react-bootstrap/Container';

import { RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IAllProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
}

class AllState {
  adventures: IIdentified<IAdventure>[] = [];
}

class All extends React.Component<IAllProps, AllState> {
  private _stopWatchingAdventures: (() => void) | undefined;

  constructor(props: IAllProps) {
    super(props);
    this.state = new AllState();

    this.getAdventures = this.getAdventures.bind(this);
    this.setAdventure = this.setAdventure.bind(this);
  }

  private getAdventures(): IAdventureSummary[] {
    return this.state.adventures.map(a => new SummaryOfAdventure(a.id, a.record));
  }

  private setAdventure(id: string | undefined, name: string, description: string) {
    var uid = this.props.dataService?.getUid();
    if (uid === undefined) {
      return;
    }

    var isNew = id === undefined;
    var existing = this.state.adventures.find(a => a.id === id)?.record;
    var updated = {
      id: id ?? uuidv4(), // TODO learn about uuid versions, pick one least likely to clash :)
      name: name,
      description: description,
      owner: uid
    } as IAdventureSummary;

    editAdventure(this.props.dataService, isNew, updated, existing)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));
  }

  private watchAdventures() {
    this._stopWatchingAdventures?.();
    this._stopWatchingAdventures = this.props.dataService?.watchAdventures(
      a => this.setState({ adventures: a }),
      e => console.error("Error watching adventures:", e)
    );
  }

  componentDidMount() {
    this.watchAdventures();
  }

  componentDidUpdate(prevProps: IAllProps) {
    if (this.props.dataService !== prevProps.dataService) {
      this.watchAdventures();
    }
  }

  componentWillUnmount() {
    this._stopWatchingAdventures?.();
    this._stopWatchingAdventures = undefined;
  }

  render() {
    return (
      <div>
        <Navigation getTitle={() => undefined}/>
        <Container>
          <AdventureCollection getAdventures={this.getAdventures} setAdventure={this.setAdventure} />
        </Container>
      </div>
    );
  }
}

interface IAllPageProps {}

function AllPage(props: RouteComponentProps<IAllPageProps>) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <All dataService={context.dataService} profile={context.profile} />
      )}
    </AppContext.Consumer>
  );
}

export default AllPage;
