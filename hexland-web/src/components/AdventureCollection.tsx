import React, { useState, useMemo, useCallback } from 'react';
import '../App.css';

import AdventureCards from './AdventureCards';
import AdventureModal from './AdventureModal';

import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

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

  const newAdventureCard = useMemo(
    () => {
      if (props.createAdventure === undefined) {
        return undefined;
      }

      return (
        <Card className="mt-4" style={{ minWidth: '16rem', maxWidth: '16rem' }}
          bg="dark" text="white" key="new">
          <Card.Body>
            <Button onClick={handleNewAdventureClick}>New adventure</Button>
          </Card.Body>
        </Card>
      );
    }, [props.createAdventure, handleNewAdventureClick]);

  return (
    <div>
      <AdventureCards newAdventureCard={newAdventureCard} adventures={props.adventures} />
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