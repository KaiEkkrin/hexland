import React, { useState, useEffect, useContext, useMemo } from 'react';
import './App.css';

import { UserContext } from './components/FirebaseContextProvider';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';

import { IInvite } from './data/invite';
import { joinAdventure } from './services/extensions';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, useHistory } from 'react-router-dom';

function Invite(props: IInvitePageProps) {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const history = useHistory();

  const [invite, setInvite] = useState(undefined as IInvite | undefined);
  useEffect(() => {
    if (userContext.dataService !== undefined) {
      var inviteRef = userContext.dataService.getInviteRef(props.adventureId, props.inviteId);
      userContext.dataService.get(inviteRef)
        .then(i => setInvite(i))
        .catch(e => console.error("Failed to fetch invite " + props.inviteId, e));
    }
  }, [userContext.dataService, props.adventureId, props.inviteId]);

  // TODO #33 : Remove this after I'm confident there are no more issues with invites.
  useEffect(() => {
    console.log("invite page sees user: " + (userContext.user === undefined ? "undefined" :
      userContext.user === null ? "null" : userContext.user.displayName));
  }, [userContext.user]);

  const inviteDescription = useMemo(() =>
    invite === undefined ? "(no such invite)" : invite.adventureName + " by " + invite.ownerName,
    [invite]);

  function handleJoin() {
    joinAdventure(userContext.dataService, profile, props.adventureId)
      .then(() => history.replace("/adventure/" + props.adventureId))
      .catch(e => console.error("Failed to join adventure " + props.adventureId, e));
  }

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        <h5>{userContext.user?.displayName ?? "Unknown"}, you have been invited to join {inviteDescription}.</h5>
        <Button variant="primary" onClick={handleJoin}>Join</Button>
      </header>
    </div>
  );
}

interface IInvitePageProps {
  adventureId: string;
  inviteId: string;
}

function InvitePage(props: RouteComponentProps<IInvitePageProps>) {
  return (
    <RequireLoggedIn>
      <Invite adventureId={props.match.params.adventureId} inviteId={props.match.params.inviteId} />
    </RequireLoggedIn>
  );
}

export default InvitePage;
