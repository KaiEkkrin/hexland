import React, { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import './App.css';

import { AnalyticsContext } from './components/AnalyticsContextProvider';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IInvite } from './data/invite';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, useHistory } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

function Invite(props: IInvitePageProps) {
  const userContext = useContext(UserContext);
  const profile = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  // Because the `joinAdventure` function is likely to be cold-started and may take a
  // little while to run, we change the button to "Joining..." while it's happening:
  const [buttonDisabled, setButtonDisabled] = useState(false);
  const buttonText = useMemo(() => buttonDisabled ? 'Joining...' : 'Join', [buttonDisabled]);

  useEffect(() => {
    if (props.inviteId) {
      setButtonDisabled(false);
    }
  }, [props.inviteId]);

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
    setButtonDisabled(true);
    userContext.functionsService?.joinAdventure(props.adventureId, props.inviteId)
      .then(() => {
        analyticsContext.analytics?.logEvent("join_group", { "group_id": props.adventureId });
        history.replace("/adventure/" + props.adventureId);
      })
      .catch(e => {
        setButtonDisabled(false);
        analyticsContext.logError("Failed to join adventure " + props.adventureId, e);
        const message = String(e.message);
        if (message) {
          statusContext.toasts.next({ id: uuidv4(), record: {
            title: "Error joining adventure", message: message
          }});
        }
      });
  }, [analyticsContext, userContext, props.adventureId, props.inviteId, history, setButtonDisabled, statusContext]);

  return (
    <div>
      <Navigation />
      <header className="App-header">
        <h5>{profile?.name ?? "Unknown"}, you have been invited to join {inviteDescription}.</h5>
        <Button variant="primary" disabled={buttonDisabled} onClick={handleJoin}>{buttonText}</Button>
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
