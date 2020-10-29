import React, { useMemo } from 'react';

import '../Map.css'; // bit of a misnomer right there

import { ICharacter } from '../data/character';
import { IPlayer } from '../data/adventure';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ListGroup from 'react-bootstrap/ListGroup';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEdit, faTimes } from '@fortawesome/free-solid-svg-icons';
import SpriteImage from './SpriteImage';

interface ICharacterBaseProps {
  canEdit?: boolean | undefined;
  handleEdit?: ((c: ICharacter) => void) | undefined;
  handleDelete?: ((c: ICharacter) => void) | undefined;
  showPlayerNames?: boolean | undefined;
}

interface ICharacterItemProps extends ICharacterBaseProps {
  character: ICharacter;
  playerName: string;
}

function CharacterItem({
  canEdit, character, handleEdit, handleDelete, playerName, showPlayerNames
}: ICharacterItemProps) {
  const desc = useMemo(() => (
    <React.Fragment>
      {character.name}
      {character.sprites.length > 0 ? (
        <SpriteImage className="ml-2" sprite={character.sprites[0]} altName={`Image of ${character.name}`}
          size={32} border="1px solid" borderColour="grey" />
      ) : null}
    </React.Fragment>
  ), [character.name, character.sprites]);

  const pn = useMemo(
    () => showPlayerNames === true ? (<div>{playerName}</div>) : null,
    [playerName, showPlayerNames]
  );

  return (
    <ListGroup.Item className="Map-info-list-item">
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        <div>{desc}</div>
        {pn}
        {canEdit === true ? (
          <ButtonGroup className="ml-2">
            <Button variant="primary" onClick={() => handleEdit?.(character)}>
              <FontAwesomeIcon icon={faEdit} color="white" />
            </Button>
            <Button variant="danger" onClick={() => handleDelete?.(character)}>
              <FontAwesomeIcon icon={faTimes} color="white" />
            </Button>
          </ButtonGroup>
        ) : null}
      </div>
    </ListGroup.Item>
  );
}

interface ICharacterListProps extends ICharacterBaseProps {
  players: IPlayer[];
}

function CharacterList({ players, ...otherProps }: ICharacterListProps) {
  return (
    <ListGroup variant="flush">
      {players.flatMap(p => p.characters.map(c =>
        (<CharacterItem key={c.id} character={c} playerName={p.playerName} {...otherProps} />)
      ))}
    </ListGroup>
  );
}

export default CharacterList;