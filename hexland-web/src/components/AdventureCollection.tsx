import React, { useState } from 'react';
import '../App.css';

import AdventureCards from './AdventureCards';
import AdventureModal from './AdventureModal';

import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

interface IAdventureCollectionProps {
  uid: string | undefined;
  adventures: IAdventureSummary[];
  setAdventure: ((id: string | undefined, name: string, description: string) => void) | undefined;
}

function AdventureCollection(props: IAdventureCollectionProps) {
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [editName, setEditName] = useState("New adventure");
  const [editDescription, setEditDescription] = useState("");
  const [showEditAdventure, setShowEditAdventure] = useState(false);

  function canEditAdventure(a: IAdventureSummary) {
    return props.setAdventure !== undefined && a.owner === props.uid;
  }

  function handleNewAdventureClick() {
    setEditId(undefined);
    setEditName("New adventure");
    setEditDescription("");
    setShowEditAdventure(true);
  }

  function handleEditAdventureClick(id: string) {
    var adventure = props.adventures.find(a => a.id === id);
    if (adventure === undefined) {
      return;
    }

    setEditId(id);
    setEditName(adventure.name);
    setEditDescription(adventure.description);
    setShowEditAdventure(true);
  }

  function handleEditAdventureSave() {
    props.setAdventure?.(editId, editName, editDescription);
    setShowEditAdventure(false);
  }

  const newAdventureCard = (
    <Card className="mt-4" style={{ minWidth: '16rem', maxWidth: '16rem' }}
      bg="dark" text="white" key="new">
      <Card.Body>
        <Button onClick={handleNewAdventureClick}>New adventure</Button>
      </Card.Body>
    </Card>
  );

  return (
    <div>
      <AdventureCards newAdventureCard={newAdventureCard} adventures={props.adventures}
        canEditAdventure={canEditAdventure} editAdventure={handleEditAdventureClick} />
      <AdventureModal description={editDescription}
        name={editName}
        show={showEditAdventure}
        handleClose={() => setShowEditAdventure(false)}
        handleSave={handleEditAdventureSave}
        setDescription={setEditDescription}
        setName={setEditName} />
    </div>
  );
}

export default AdventureCollection;