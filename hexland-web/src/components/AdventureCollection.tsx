import React, { useState, useCallback } from 'react';
import '../App.css';

import AdventureCards from './AdventureCards';
import AdventureModal from './AdventureModal';

import { IAdventureSummary } from '../data/profile';

interface IAdventureCollectionProps {
  uid: string | undefined;
  adventures: IAdventureSummary[];
  createAdventure: ((name: string, description: string) => void) | undefined;
}

function AdventureCollection(props: IAdventureCollectionProps) {
  const [editName, setEditName] = useState("New adventure");
  const [editDescription, setEditDescription] = useState("");
  const [showEditAdventure, setShowEditAdventure] = useState(false);

  const handleNewAdventureClick = useCallback(() => {
    setEditName("New adventure");
    setEditDescription("");
    setShowEditAdventure(true);
  }, [setEditName, setEditDescription, setShowEditAdventure]);

  function handleNewAdventureSave() {
    props.createAdventure?.(editName, editDescription);
    setShowEditAdventure(false);
  }

  return (
    <div>
      <AdventureCards handleCreate={handleNewAdventureClick} adventures={props.adventures}
        showNewAdventureCard={props.createAdventure !== undefined} />
      <AdventureModal description={editDescription}
        name={editName}
        show={showEditAdventure}
        handleClose={() => setShowEditAdventure(false)}
        handleSave={handleNewAdventureSave}
        setDescription={setEditDescription}
        setName={setEditName} />
    </div>
  );
}

export default AdventureCollection;