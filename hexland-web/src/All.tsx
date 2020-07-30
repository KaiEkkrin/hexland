import React from 'react';
import './App.css';

import AdventureCards from './AdventureCards';
import AdventureModal from './AdventureModal';
import { AppContext, AppState } from './App';
import Navigation from './Navigation';

import { IAdventure, SummaryOfAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { IProfile } from './data/profile';
import { propagateAdventureEdit } from './services/extensions';
import { IDataService } from './services/interfaces';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';

import { RouteComponentProps } from 'react-router-dom';

import { v4 as uuidv4 } from 'uuid';

interface IAllProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined;
}

class AllState {
  adventures: IIdentified<IAdventure>[] = [];
  editId: string | undefined = undefined;
  editName = "New adventure";
  editDescription = "";
  showEditAdventure = false; // TODO showDeleteAdventure as well
}

class All extends React.Component<IAllProps, AllState> {
  private _stopWatchingAdventures: (() => void) | undefined;

  constructor(props: IAllProps) {
    super(props);
    this.state = new AllState();

    this.handleNewAdventureClick = this.handleNewAdventureClick.bind(this);
    this.handleEditAdventureClick = this.handleEditAdventureClick.bind(this);
    this.handleEditAdventureSave = this.handleEditAdventureSave.bind(this);
  }

  private handleNewAdventureClick() {
    this.setState({ editId: undefined, editName: "New adventure", editDescription: "", showEditAdventure: true });
  }

  private handleEditAdventureClick(id: string) {
    var adventure = this.state.adventures.find(a => a.id === id)?.record;
    if (adventure === undefined) {
      return;
    }

    this.setState({ editId: id, editName: adventure.name, editDescription: adventure.description, showEditAdventure: true });
  }

  private handleEditAdventureSave() {
    this.setState({ showEditAdventure: false });

    var uid = this.props.dataService?.getUid();
    if (uid === undefined) {
      return;
    }

    var id = this.state.editId ?? uuidv4(); // TODO learn about uuid versions, pick one least likely to clash :)
    var existing = this.state.adventures.find(a => a.id === this.state.editId)?.record;
    var adventure = {
      name: this.state.editName,
      description: this.state.editDescription,
      owner: uid,
      maps: existing?.maps ?? []
    } as IAdventure;

    this.props.dataService?.setAdventure(id, adventure)
      .then(() => console.log("Adventure " + id + " successfully edited"))
      .catch(e => console.error("Error editing adventure " + id, e));

    // Make this one of my latest adventures if it isn't already
    propagateAdventureEdit(this.props.dataService, this.props.profile, new SummaryOfAdventure(id, adventure))
      .then(() => console.log("Updated profile with adventure " + id))
      .catch(e => console.error("Error updating profile:", e));
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
          <Row className="mt-4">
            <Col>
              <Button onClick={this.handleNewAdventureClick}>New adventure</Button>
            </Col>
          </Row>
          <Row className="mt-4">
            <Col>
              <AdventureCards adventures={this.state.adventures.map(a => new SummaryOfAdventure(a.id, a.record))}
                editAdventure={this.handleEditAdventureClick} />
            </Col>
          </Row>
        </Container>
        <AdventureModal getDescription={() => this.state.editDescription}
          getName={() => this.state.editName}
          getShow={() => this.state.showEditAdventure}
          handleClose={() => this.setState({ showEditAdventure: false })}
          handleSave={this.handleEditAdventureSave}
          setDescription={(value: string) => this.setState({ editDescription: value })}
          setName={(value: string) => this.setState({ editName: value })} />
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
