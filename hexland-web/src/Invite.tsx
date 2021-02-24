import { useState, useEffect, useContext, useMemo, useCallback } from 'react';
import './App.css';

import { AnalyticsContext } from './components/AnalyticsContextProvider';
import BusyElement from './components/BusyElement';
import Navigation from './components/Navigation';
import { ProfileContext } from './components/ProfileContextProvider';
import { RequireLoggedIn } from './components/RequireLoggedIn';
import { StatusContext } from './components/StatusContextProvider';
import { UserContext } from './components/UserContextProvider';

import { IInvite } from './data/invite';

import Button from 'react-bootstrap/Button';

import { RouteComponentProps, useHistory } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';

interface IInvitePageProps {
  inviteId: string;
}

function Invite({ inviteId }: IInvitePageProps) {
  const userContext = useContext(UserContext);
  const { profile } = useContext(ProfileContext);
  const analyticsContext = useContext(AnalyticsContext);
  const statusContext = useContext(StatusContext);
  const history = useHistory();

  // Because the `joinAdventure` function is likely to be cold-started and may take a
  // little while to run, we change the button to "Joining..." while it's happening:
  const [buttonDisabled, setButtonDisabled] = useState(false);
  useEffect(() => {
    if (inviteId) {
      setButtonDisabled(false);
    }
  }, [inviteId]);

  const [invite, setInvite] = useState(undefined as IInvite | undefined);
  useEffect(() => {
    if (userContext.dataService !== undefined) {
      let inviteRef = userContext.dataService.getInviteRef(inviteId);
      userContext.dataService.get(inviteRef)
        .then(i => setInvite(i))
        .catch(e => analyticsContext.logError("Failed to fetch invite " + inviteId, e));
    }
  }, [userContext.dataService, analyticsContext, inviteId]);

  const inviteDescription = useMemo(() =>
    invite === undefined ? "(no such invite)" : invite.adventureName + " by " + invite.ownerName,
    [invite]);

  const handleJoin = useCallback(() => {
    setButtonDisabled(true);
    userContext.functionsService?.joinAdventure(inviteId)
      .then(adventureId => {
        analyticsContext.analytics?.logEvent("join_group", { "group_id": adventureId });
        history.replace("/adventure/" + adventureId);
      })
      .catch(e => {
        setButtonDisabled(false);
        analyticsContext.logError("Failed to join using invite " + inviteId, e);
        const message = String(e.message);
        if (message) {
          statusContext.toasts.next({ id: uuidv4(), record: {
            title: "Error joining adventure", message: message
          }});
        }
      });
  }, [analyticsContext, userContext, inviteId, history, setButtonDisabled, statusContext]);

  return (
    <div>
      <Navigation />
      <header className="App-header">
        <h5>{profile?.name ?? "Unknown"}, you have been invited to join {inviteDescription}.</h5>
        <Button variant="primary" disabled={buttonDisabled} onClick={handleJoin}>
          <BusyElement normal="Join" busy="Joining..." isBusy={buttonDisabled} />
        </Button>
      </header>
    </div>
  );
}

function InvitePage(props: RouteComponentProps<IInvitePageProps>) {
  return (
    <RequireLoggedIn>
      <Invite inviteId={props.match.params.inviteId} />
    </RequireLoggedIn>
  );
}

export default InvitePage;
