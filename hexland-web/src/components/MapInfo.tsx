import React, { useMemo, useState } from 'react';

import { IPlayer } from '../data/adventure';
import { IGridCoord } from '../data/coord';
import { IToken } from '../data/feature';
import { IMap } from '../data/map';
import PlayerInfoList from './PlayerInfoList';

import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Nav from 'react-bootstrap/Nav';

import { faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import fluent from 'fluent-iterable';

// A quick utility function for figuring out whether a player has any
// tokens assigned to them so we can show status.
// Returns undefined for the owner, who is a special case (we don't care.)
function hasAnyTokens(map: IMap | undefined, player: IPlayer, tokens: IToken[]) {
  if (player.playerId === map?.owner) {
    return undefined;
  }

  return fluent(tokens).any(
    t => t.players.find(pId => pId === player.playerId) !== undefined
  );
}

// Provides informational things on the right-hand side of the map view.
// All of them should default to unexpanded (button only form) and
// toggle to expand.

interface IMapInfoCardProps {
  title: string;
  buttonContent: React.ReactNode;
  children: React.ReactNode;
}

function MapInfoCard(props: IMapInfoCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);

  if (isCollapsed) {
    return (
      <Button className="Map-info-card mb-2" title="Players" variant="dark" onClick={() => setIsCollapsed(false)}>
        {props.buttonContent}
      </Button>
    );
  }

  return (
    <Card className="Map-info-card mb-2" bg="dark" text="white">
      <Card.Header>
        <Nav className="justify-content-between">
          <Nav.Item>
            <h5>{props.title}</h5>
          </Nav.Item>
          <Nav.Item>
            <Button variant="dark" onClick={() => setIsCollapsed(true)}>
              {props.buttonContent}
            </Button>
          </Nav.Item>
        </Nav>
      </Card.Header>
      {props.children}
    </Card>
  );
}

interface IMapInfoProps {
  map: IMap | undefined;
  players: IPlayer[];
  tokens: IToken[];
  resetView: (centreOn?: IGridCoord | undefined) => void;
}

function MapInfo(props: IMapInfoProps) {
  const numberOfPlayersWithNoTokens = useMemo(
    () => fluent(props.players).filter(p => hasAnyTokens(props.map, p, props.tokens) === false).count(),
    [props.map, props.players, props.tokens]
  );

  const hideNumberOfPlayersWithNoTokens = useMemo(
    () => numberOfPlayersWithNoTokens === 0,
    [numberOfPlayersWithNoTokens]
  );

  const ownerUid = useMemo(() => props.map?.owner, [props.map]);

  const playerInfoButton = useMemo(() => (
    <div>
      <FontAwesomeIcon icon={faUsers} color="white" />
      <Badge className="ml-1" hidden={hideNumberOfPlayersWithNoTokens} variant="danger">
        {numberOfPlayersWithNoTokens}
      </Badge>
    </div>
  ), [numberOfPlayersWithNoTokens, hideNumberOfPlayersWithNoTokens]);

  return (
    <div className="Map-info">
      <MapInfoCard title="Players" buttonContent={playerInfoButton}>
        <PlayerInfoList ownerUid={ownerUid} showNoTokenWarning={true} {...props} />
      </MapInfoCard>
    </div>
  );
}

export default MapInfo;