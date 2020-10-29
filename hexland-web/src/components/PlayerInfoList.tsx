import React, { useMemo } from 'react';

import { IPlayer } from '../data/adventure';
import { ITokenProperties } from '../data/feature';
import { hexColours } from '../models/featureColour';

import SpriteImage from './SpriteImage';

import Badge from 'react-bootstrap/Badge';
import Dropdown from 'react-bootstrap/Dropdown';
import ListGroup from 'react-bootstrap/ListGroup';

interface IPlayerInfoListPropsBase {
  ownerUid: string | undefined;
  tokens: ITokenProperties[];
  showBlockedPlayers?: boolean | undefined;
  showBlockButtons?: boolean | undefined;
  showNoTokenWarning?: boolean | undefined;
  blockPlayer?: ((player: IPlayer) => void) | undefined;
  unblockPlayer?: ((player: IPlayer) => void) | undefined;
  resetView?: ((centreOn?: string | undefined) => void) | undefined; // centres on the token with the given id
}

interface IPlayerInfoListItemProps extends IPlayerInfoListPropsBase {
  player: IPlayer;
}

function PlayerInfoListItem(props: IPlayerInfoListItemProps) {
  const blockedBadge = useMemo(
    () => props.player.allowed === false ?
      <Badge className="ml-2 mt-1" variant="danger" title={"Player " + props.player.playerName + " is blocked"}>BLOCKED</Badge> :
      undefined,
    [props.player]
  );

  const blockItem = useMemo(
    () => (props.showBlockButtons !== true || props.player.playerId === props.ownerUid) ? undefined :
      props.player.allowed === false ? <Dropdown.Item onClick={() => props.unblockPlayer?.(props.player)}>Unblock</Dropdown.Item> :
      <Dropdown.Item onClick={() => props.blockPlayer?.(props.player)}>Block</Dropdown.Item>,
    [props.ownerUid, props.player, props.showBlockButtons, props.blockPlayer, props.unblockPlayer]
  );

  const myTokens = useMemo(
    () => props.tokens.filter(t => t.players.find(p => p === props.player.playerId) !== undefined),
    [props.player, props.tokens]
  );

  const isNoTokenHidden = useMemo(
    () => props.player.playerId === props.ownerUid,
    [props.ownerUid, props.player]
  );

  const badges = useMemo(() => {
    if (props.player.playerId === props.ownerUid) {
      return [(
        <Badge key="ownerBadge" className="ml-2 mt-1" variant="warning"
          title={"Player " + props.player.playerName + " is the owner"}
        >Owner</Badge>
      )];
    } else if (myTokens.length > 0) {
      return myTokens.map(t => {
        const key = `badge_${t.id}`;
        const title = `Player ${props.player.playerName} has token ${t.text}`;
        if (t.sprites.length > 0) {
          return (
            <SpriteImage key={key} className="ml-2 mt-1" altName={title}
              size={32} border="1px solid" borderColour={hexColours[t.colour]} sprite={t.sprites[0]}
              onClick={() => props.resetView?.(t.id)} />
          );
        } else {
          return (
            <Badge key={key} className="ml-2 mt-1" title={title}
              style={{ backgroundColor: hexColours[t.colour], color: "black", userSelect: "none" }}
              onClick={() => props.resetView?.(t.id)}
            >{t.text}</Badge>
          );
        }
      });
    } else if (props.showNoTokenWarning === true) {
      return [(
        <Badge key="noTokenBadge" className="ml-2 mt-1" hidden={isNoTokenHidden} variant="warning"
          title={"Player " + props.player.playerName + " has no token"}
        >No token</Badge>
      )];
    } else {
      return [];
    }
  }, [isNoTokenHidden, myTokens, props.ownerUid, props.player, props.resetView, props.showNoTokenWarning]);

  const contentItems = useMemo(() => {
    // Always show the player name
    const items = [(
      <div key="nameItem" style={{ wordBreak: "break-all", wordWrap: "break-word" }}>{props.player.playerName}{blockedBadge}</div>
    )];

    // If we have a block item, show that in a little menu to make it less threatening
    if (blockItem !== undefined) {
      items.push((
        <Dropdown key="manageItem">
          <Dropdown.Toggle className="ml-2" variant="secondary" size="sm">Manage</Dropdown.Toggle>
          <Dropdown.Menu>{blockItem}</Dropdown.Menu>
        </Dropdown>
      ));
    }

    // If we have any badges, include those
    if (badges.length > 0) {
      items.push((
        <div key="badgesItem" style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
          {badges}
        </div>
      ));
    }

    return items;
  }, [badges, blockedBadge, blockItem, props.player]);

  return (
    <ListGroup.Item className="Map-info-list-item">
      <div title={"Player " + props.player.playerName}
        style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between" }}
      >
        {contentItems}
      </div>
    </ListGroup.Item>
  );
}

export interface IPlayerInfoListProps extends IPlayerInfoListPropsBase {
  players: IPlayer[];
}

function PlayerInfoList(props: IPlayerInfoListProps) {
  return (
    <ListGroup variant="flush">
      {props.players.filter(p => props.showBlockedPlayers === true || p.allowed !== false).map(p => (
        <PlayerInfoListItem key={p.playerId} player={p} {...props} />
      ))}
    </ListGroup>
  );
}

export default PlayerInfoList;