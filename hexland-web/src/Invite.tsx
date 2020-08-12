import React, { useState, useEffect, useContext } from 'react';
import './App.css';

import { UserContext, ProfileContext } from './App';
import Navigation from './components/Navigation';
import { IInvite } from './data/invite';
import { IProfile } from './data/profile';
import { joinAdventure } from './services/extensions';
import { IDataService } from './services/interfaces';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, Redirect } from 'react-router-dom';

interface IInviteProps extends IInvitePageProps {
  dataService: IDataService | undefined;
  profile: IProfile | undefined
}

function Invite(props: IInviteProps) {
  const [invite, setInvite] = useState(undefined as IInvite | undefined);
  useEffect(() => {
    if (props.dataService !== undefined) {
      var inviteRef = props.dataService.getInviteRef(props.adventureId, props.inviteId);
      props.dataService.get(inviteRef)
        .then(i => setInvite(i))
        .catch(e => console.error("Failed to fetch invite " + props.inviteId, e));
    }
  }, [props.dataService, props.adventureId, props.inviteId]);

  function getInviteDescription() {
    return invite === undefined ? "" : invite.adventureName + " by " + invite.ownerName;
  }

  const [joined, setJoined] = useState(false);
  function handleJoin() {
    joinAdventure(props.dataService, props.profile, props.adventureId)
      .then(() => setJoined(true))
      .catch(e => console.error("Failed to join adventure " + props.adventureId, e));
  }

  function getAdventureLink() {
    return "/adventure/" + props.adventureId;
  }

  return (
    <div>
      <Navigation getTitle={() => undefined} />
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
  var userContext = useContext(UserContext);
  var profile = useContext(ProfileContext);
  return userContext.user === null ? <div></div> : (
    <Invite dataService={userContext.dataService} profile={profile}
      adventureId={props.match.params.adventureId} inviteId={props.match.params.inviteId} />);
}

export default InvitePage;
