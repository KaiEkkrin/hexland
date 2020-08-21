import React, { useMemo, useState } from 'react';

import { IPlayer } from '../data/adventure';
import { IToken } from '../data/feature';
import { IMap } from '../data/map';
import { hexColours } from '../models/featureColour';

import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';
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
      <Button className="Map-info-card mb-2" variant="dark" onClick={() => setIsCollapsed(false)}>
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

interface IPlayerInfoListItemProps {
  map: IMap | undefined;
  player: IPlayer;
  tokens: IToken[];
}

function PlayerInfoListItem(props: IPlayerInfoListItemProps) {
  const myTokens = useMemo(
    () => props.tokens.filter(t => t.players.find(p => p === props.player.playerId) !== undefined),
    [props.player, props.tokens]
  );

  const isNoTokenHidden = useMemo(
    () => props.player.playerId === props.map?.owner,
    [props.map, props.player]
  );

  const showOwnerBadge = useMemo(
    () => props.player.playerId === props.map?.owner,
    [props.map, props.player]
  );

  return (
    <ListGroup.Item className="Map-info-list-item">
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {props.player.playerName}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {showOwnerBadge ? (
            <Badge className="ml-2" variant="warning">Owner</Badge>
          ) : myTokens.length > 0 ? myTokens.map(t => (
            <Badge className="ml-2" style={{ backgroundColor: hexColours[t.colour], color: "black" }}>{t.text}</Badge>
          )) : (
                <Badge className="ml-2" hidden={isNoTokenHidden} variant="danger">No token</Badge>
              )}
        </div>
      </div>
    </ListGroup.Item>
  );
}

interface IPlayerInfoListProps {
  map: IMap | undefined;
  players: IPlayer[];
  tokens: IToken[];
}

function PlayerInfoList(props: IPlayerInfoListProps) {
  return (
    <ListGroup variant="flush">
      {props.players.map(p => (
        <PlayerInfoListItem map={props.map} player={p} tokens={props.tokens} />
      ))}
    </ListGroup>
  );
}

interface IMapInfoProps {
  map: IMap | undefined;
  players: IPlayer[];
  tokens: IToken[];
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
        <PlayerInfoList map={props.map} players={props.players} tokens={props.tokens} />
      </MapInfoCard>
    </div>
  );
}

export default MapInfo;