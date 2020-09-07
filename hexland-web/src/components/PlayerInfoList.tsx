import React, { useMemo } from 'react';

import { IPlayer } from '../data/adventure';
import { IGridCoord } from '../data/coord';
import { IToken } from '../data/feature';
import { hexColours } from '../models/featureColour';

import Badge from 'react-bootstrap/Badge';
import ListGroup from 'react-bootstrap/ListGroup';

interface IPlayerInfoListItemProps {
  ownerUid: string | undefined;
  player: IPlayer;
  tokens: IToken[];
  showNoTokenWarning?: boolean | undefined;
  resetView?: ((centreOn?: IGridCoord | undefined) => void) | undefined;
}

function PlayerInfoListItem(props: IPlayerInfoListItemProps) {
  const myTokens = useMemo(
    () => props.tokens.filter(t => t.players.find(p => p === props.player.playerId) !== undefined),
    [props.player, props.tokens]
  );

  const isNoTokenHidden = useMemo(
    () => props.player.playerId === props.ownerUid,
    [props.ownerUid, props.player]
  );

  const showOwnerBadge = useMemo(
    () => props.player.playerId === props.ownerUid,
    [props.ownerUid, props.player]
  );

  return (
    <ListGroup.Item className="Map-info-list-item">
      <div title={"Player " + props.player.playerName}
        style={{ display: "flex", justifyContent: "space-between" }}
      >{props.player.playerName}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center" }}>
          {showOwnerBadge ? (
            <Badge className="ml-2" variant="warning"
              title={"Player " + props.player.playerName + " is the owner"}
            >Owner</Badge>
          ) : myTokens.length > 0 ? myTokens.map(t => (
            <Badge className="ml-2" key={t.id}
              title={"Player " + props.player.playerName + " has token " + t.text}
              style={{ backgroundColor: hexColours[t.colour], color: "black", userSelect: "none" }}
              onClick={() => props.resetView?.(t.position)}
            >{t.text}</Badge>
          )) : props.showNoTokenWarning === true ? (
            <Badge className="ml-2" hidden={isNoTokenHidden} variant="danger"
              title={"Player " + props.player.playerName + " has no token"}
            >No token</Badge>
          ) : (<div></div>)}
        </div>
      </div>
    </ListGroup.Item>
  );
}

export interface IPlayerInfoListProps {
  ownerUid: string | undefined;
  players: IPlayer[];
  tokens: IToken[];
  showNoTokenWarning?: boolean | undefined;
  resetView?: ((centreOn?: IGridCoord | undefined) => void) | undefined;
}

function PlayerInfoList(props: IPlayerInfoListProps) {
  return (
    <ListGroup variant="flush">
      {props.players.map(p => (
        <PlayerInfoListItem key={p.playerId} player={p} {...props} />
      ))}
    </ListGroup>
  );
}

export default PlayerInfoList;