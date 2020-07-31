import React from 'react';
import './App.css';

import AdventureCards from './AdventureCards';
import AdventureModal from './AdventureModal';

import { IAdventureSummary } from './data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

interface IAdventureCollectionProps {
  getAdventures: () => IAdventureSummary[];
  setAdventure: (id: string | undefined, name: string, description: string) => void;
}

class AdventureCollectionState {
  editId: string | undefined = undefined;
  editName = "New adventure";
  editDescription = "";
  showEditAdventure = false; // TODO showDeleteAdventure as well
}

class AdventureCollection extends React.Component<IAdventureCollectionProps, AdventureCollectionState> {
  constructor(props: IAdventureCollectionProps) {
    super(props);
    this.state = new AdventureCollectionState();

    this.handleNewAdventureClick = this.handleNewAdventureClick.bind(this);
    this.handleEditAdventureClick = this.handleEditAdventureClick.bind(this);
    this.handleEditAdventureSave = this.handleEditAdventureSave.bind(this);
  }

  private handleNewAdventureClick() {
    this.setState({ editId: undefined, editName: "New adventure", editDescription: "", showEditAdventure: true });
  }

  private handleEditAdventureClick(id: string) {
    var adventure = this.props.getAdventures().find(a => a.id === id);
    if (adventure === undefined) {
      return;
    }

    this.setState({
      editId: id,
      editName: adventure.name,
      editDescription: adventure.description,
      showEditAdventure: true
    });
  }

  private handleEditAdventureSave() {
    this.setState({ showEditAdventure: false });
    this.props.setAdventure(this.state.editId, this.state.editName, this.state.editDescription);
  }

  render() {
    var newAdventureCard =
      <Card className="mt-4" style={{ minWidth: '16rem', maxWidth: '16rem' }}
        bg="dark" text="white" key="new">
        <Card.Body>
          <Button onClick={this.handleNewAdventureClick}>New adventure</Button>
        </Card.Body>
      </Card>;

    return (
      <div>
        <AdventureCards newAdventureCard={newAdventureCard} adventures={this.props.getAdventures()}
          editAdventure={this.handleEditAdventureClick} />
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

export default AdventureCollection;
