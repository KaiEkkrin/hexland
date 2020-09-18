import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import './App.css';

import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { UserContext } from './components/UserContextProvider';

import { IInvite } from './data/invite';
import { joinAdventure } from './services/extensions';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, useHistory } from 'react-router-dom';

function Invite(props: IInvitePageProps) {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);
  const history = useHistory();

  const [invite, setInvite] = useState(undefined as IInvite | undefined);
  useEffect(() => {
    if (userContext.dataService !== undefined) {
      let inviteRef = userContext.dataService.getInviteRef(props.adventureId, props.inviteId);
      userContext.dataService.get(inviteRef)
        .then(i => setInvite(i))
        .catch(e => analyticsContext.logError("Failed to fetch invite " + props.inviteId, e));
    }
  }, [userContext.dataService, analyticsContext, props.adventureId, props.inviteId]);

  const inviteDescription = useMemo(() =>
    invite === undefined ? "(no such invite)" : invite.adventureName + " by " + invite.ownerName,
    [invite]);

  const handleJoin = useCallback(() => {
    analyticsContext.analytics?.logEvent("join_group", { "group_id": props.adventureId });
    joinAdventure(userContext.dataService, profile, userContext.user?.uid, props.adventureId)
      .then(() => history.replace("/adventure/" + props.adventureId))
      .catch(e => analyticsContext.logError("Failed to join adventure " + props.adventureId, e));
  }, [analyticsContext, userContext, props.adventureId, profile, history]);

  return (
    <div>
      <Navigation title={undefined} />
      <header className="App-header">
        <h5>{profile?.name ?? "Unknown"}, you have been invited to join {inviteDescription}.</h5>
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
