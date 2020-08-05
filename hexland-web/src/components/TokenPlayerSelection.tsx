import React from 'react';

import { IPlayer } from '../data/adventure';

import Form from 'react-bootstrap/Form';

interface ITokenPlayerSelectionProps {
  players: IPlayer[];
  tokenPlayerIds: string[];
  setTokenPlayerIds: (playerIds: string[]) => void;
}

function TokenPlayerSelection(props: ITokenPlayerSelectionProps) {
  // I need to hack the type here to coerce it into something usable
  // See https://github.com/DefinitelyTyped/DefinitelyTyped/issues/16208
  function handleChange(e: React.FormEvent<HTMLSelectElement>) {
    var selectedIds: string[] = [];
    for (var i = 0; i < e.currentTarget.selectedOptions.length; ++i) {
      var option = e.currentTarget.selectedOptions[i];
      selectedIds.push(option.value);
    }

    props.setTokenPlayerIds(selectedIds);
  }

  return (
    <Form.Control as="select" multiple value={props.tokenPlayerIds}
      onChange={e => handleChange(e as any)}>
      {props.players.map(p =>
        <option key={p.playerId} value={p.playerId}>{p.playerName}</option>
      )}
    </Form.Control>
  );
}

export default TokenPlayerSelection;