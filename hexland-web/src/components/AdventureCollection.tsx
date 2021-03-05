import { useContext, useState, useCallback } from 'react';
import '../App.css';

import AdventureCards from './AdventureCards';
import { AnalyticsContext } from './AnalyticsContextProvider';
import AdventureModal from './AdventureModal';
import { StatusContext } from './StatusContextProvider';
import { UserContext } from './UserContextProvider';

import { IAdventureSummary } from '../data/profile';

import { useHistory } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

interface IAdventureCollectionProps {
  uid: string | undefined;
  adventures: IAdventureSummary[];
  showNewAdventure: boolean;
}

function AdventureCollection(props: IAdventureCollectionProps) {
  const userContext = useContext(UserContext);
  const analyticsContext = useContext(AnalyticsContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  const [editName, setEditName] = useState("New adventure");
  const [editDescription, setEditDescription] = useState("");
  const [showEditAdventure, setShowEditAdventure] = useState(false);

  const handleNewAdventureClick = useCallback(() => {
    setEditName("New adventure");
    setEditDescription("");
    setShowEditAdventure(true);
  }, [setEditName, setEditDescription, setShowEditAdventure]);

  const handleNewAdventureSave = useCallback(async () => {
    const functionsService = userContext.functionsService;
    if (functionsService === undefined) {
      return;
    }

    try {
      const id = await functionsService.createAdventure(editName, editDescription);
      history.replace('/adventure/' + id);
    } catch (e) {
      setShowEditAdventure(false);
      analyticsContext.logError('Failed to create adventure', e);
      const message = String(e.message);
      if (message) {
        statusContext.toasts.next({ id: uuidv4(), record: {
          title: "Error creating adventure", message: message
        } });
      }
    }
  }, [analyticsContext, editName, editDescription, history, statusContext, userContext]);

  return (
    <div>
      <AdventureCards handleCreate={handleNewAdventureClick} adventures={props.adventures}
        showNewAdventureCard={props.showNewAdventure} />
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