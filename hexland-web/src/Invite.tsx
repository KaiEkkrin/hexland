import React, { useState, useEffect, useContext } from 'react';
import './App.css';

import { UserContext, ProfileContext } from './App';
import Navigation from './components/Navigation';
import { IInvite } from './data/invite';
import { joinAdventure } from './services/extensions';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, Redirect } from 'react-router-dom';

function Invite(props: IInvitePageProps) {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);

  const [invite, setInvite] = useState(undefined as IInvite | undefined);
  useEffect(() => {
    if (userContext.dataService !== undefined) {
      var inviteRef = userContext.dataService.getInviteRef(props.adventureId, props.inviteId);
      userContext.dataService.get(inviteRef)
        .then(i => setInvite(i))
        .catch(e => console.error("Failed to fetch invite " + props.inviteId, e));
    }
  }, [userContext.dataService, props.adventureId, props.inviteId]);

  function getInviteDescription() {
    return invite === undefined ? "" : invite.adventureName + " by " + invite.ownerName;
  }

  const [joined, setJoined] = useState(false);
  function handleJoin() {
    joinAdventure(userContext.dataService, profile, props.adventureId)
      .then(() => setJoined(true))
      .catch(e => console.error("Failed to join adventure " + props.adventureId, e));
  }

  function getAdventureLink() {
    return "/adventure/" + props.adventureId;
  }

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        {invite === undefined ? <div></div> :
          joined === false ? <div>
            <h5>You have been invited to join {getInviteDescription()}.</h5>
            <Button variant="primary" onClick={handleJoin} disabled={joined}>Join</Button>
          </div> : <Redirect to={getAdventureLink()} />
        }
      </header>
    </div>
  );
}

interface IInvitePageProps {
  adventureId: string;
  inviteId: string;
}

function InvitePage(props: RouteComponentProps<IInvitePageProps>) {
  const userContext = useContext(UserContext);
  return (!userContext.user) ? <Redirect to="/login" /> : (
    <Invite adventureId={props.match.params.adventureId} inviteId={props.match.params.inviteId} />);
}

export default InvitePage;
