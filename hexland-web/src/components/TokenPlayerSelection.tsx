import React from 'react';

import { IPlayer } from '../data/adventure';

import Form from 'react-bootstrap/Form';

interface ITokenPlayerSelectionProps {
  id: string;
  players: IPlayer[];
  tokenPlayerIds: string[];
  setTokenPlayerIds: (playerIds: string[]) => void;
}

function TokenPlayerSelection(props: ITokenPlayerSelectionProps) {
  // I need to hack the type here to coerce it into something usable
  // See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/16208
  function handleChange(e: React.FormEvent<HTMLSelectElement>) {
    const selectedIds: string[] = [];
    for (let i = 0; i < e.currentTarget.selectedOptions.length; ++i) {
      const option = e.currentTarget.selectedOptions[i];
      selectedIds.push(option.value);
    }

    props.setTokenPlayerIds(selectedIds);
  }

  return (
    <Form.Control id={props.id} as="select" multiple value={props.tokenPlayerIds}
      onChange={e => handleChange(e as any)}>
      {props.players.map(p =>
        <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
      )}
    </Form.Control>
  );
}

export default TokenPlayerSelection;