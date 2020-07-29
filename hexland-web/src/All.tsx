import React from 'react';
import './App.css';
import { auth } from './firebase';

import AdventureCards from './AdventureCards';
import { addRecentAdventure, AppContext, AppState } from './App';
import Navigation from './Navigation';

import { IAdventure, SummaryOfAdventure } from './data/adventure';
import { IIdentified } from './data/identified';
import { IProfile } from './data/profile';
import { IDataService } from './services/interfaces';

import Button from 'react-bootstrap/Button';
import Col from 'react-bootstrap/Col';
import Container from 'react-bootstrap/Container';
import Form from 'react-bootstrap/Form';
import Modal from 'react-bootstrap/Modal';
import Row from 'react-bootstrap/Row';

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
  showEditAdventure = false;
}

class All extends React.Component<IAllProps, AllState> {
  private _stopWatchingAdventures: (() => void) | undefined;

  constructor(props: IAllProps) {
    super(props);
    this.state = new AllState();

    this.isModalSaveDisabled = this.isModalSaveDisabled.bind(this);
    this.handleNewAdventureClick = this.handleNewAdventureClick.bind(this);
    this.handleEditAdventureClick = this.handleEditAdventureClick.bind(this);
    this.handleEditAdventureClose = this.handleEditAdventureClose.bind(this);
    this.handleEditAdventureSave = this.handleEditAdventureSave.bind(this);
  }

  private isModalSaveDisabled() {
    return this.state.editName.length === 0;
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

  private handleEditAdventureClose() {
    this.setState({ showEditAdventure: false });
  }

  private handleEditAdventureSave() {
    this.handleEditAdventureClose();

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
    addRecentAdventure(this.props.dataService, this.props.profile, new SummaryOfAdventure(id, adventure))
      .then(() => console.log("Updated profile with adventure " + id))
      .catch(e => console.error("Error updating profile:", e));
  }

  private watchAdventures() {
    this._stopWatchingAdventures?.();
    this._stopWatchingAdventures = this.props.dataService?.watchAdventures(
      a => this.setState({ adventures: a })
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
    if (auth.currentUser === null) {
      return (
        <div>
          <Navigation />
          <header className="App-header">
            <p>Log in to create or join an adventure.</p>
          </header>
        </div>
      );
    }

    return (
      <div>
        <Navigation />
        <Container>
          <Row>
            <Col>
              <Button onClick={this.handleNewAdventureClick}>New adventure</Button>
            </Col>
          </Row>
          <Row>
            <Col>
              <AdventureCards adventures={this.state.adventures.map(a => new SummaryOfAdventure(a.id, a.record))}
                editAdventure={this.handleEditAdventureClick} />
            </Col>
          </Row>
        </Container>
        <Modal show={this.state.showEditAdventure} onHide={this.handleEditAdventureClose}>
          <Modal.Header closeButton>
            <Modal.Title>New adventure</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Form>
              <Form.Group>
                <Form.Label>Name</Form.Label>
                <Form.Control type="text" maxLength={30} value={this.state.editName}
                  onChange={e => this.setState({ editName: e.target.value })} />
              </Form.Group>
              <Form.Group>
                <Form.Label>Description</Form.Label>
                <Form.Control as="textarea" rows={5} maxLength={300} value={this.state.editDescription}
                  onChange={e => this.setState({ editDescription: e.target.value })} />
              </Form.Group>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={this.handleEditAdventureClose}>Close</Button>
            <Button variant="primary" disabled={this.isModalSaveDisabled()}
              onClick={this.handleEditAdventureSave}>
              Save
            </Button>
          </Modal.Footer>
        </Modal>
      </div>
    );
  }
}

interface IAllPageProps {}

function AllPage(props: IAllPageProps) {
  return (
    <AppContext.Consumer>
      {(context: AppState) => context.user === null ? <div></div> : (
        <All dataService={context.dataService} profile={context.profile} />
      )}
    </AppContext.Consumer>
  );
}

export default AllPage;
