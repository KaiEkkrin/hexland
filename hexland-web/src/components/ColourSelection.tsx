import React from 'react';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface INegativeColourProps {
  includeNegative: boolean;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

function NegativeColour(props: INegativeColourProps) {
  if (props.includeNegative === false) {
    return null;
  }

  return (
    <ToggleButton type="radio" variant="dark" key={-1} value={-1}
      checked={props.getSelectedColour() === -1}
      onChange={(e) => props.setSelectedColour(-1)}>
      <FontAwesomeIcon icon={faSquare} color="black" />
    </ToggleButton>
  );
}

interface IColourSelectionProps {
  colours: string[];
  includeNegative: boolean;
  isVertical: boolean;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
}

function ColourSelection(props: IColourSelectionProps) {
  return (
    <ButtonGroup toggle vertical={props.isVertical === true}>
      {props.colours.map((c, i) =>
        <ToggleButton type="radio" variant="dark" key={i} value={i}
          checked={props.getSelectedColour() === i}
          onChange={e => props.setSelectedColour(i)}>
          <FontAwesomeIcon icon={faSquare} color={c} />
        </ToggleButton>
      )}
      <NegativeColour includeNegative={props.includeNegative}
        getSelectedColour={props.getSelectedColour}
        setSelectedColour={props.setSelectedColour} />
    </ButtonGroup>
  );
}

export default ColourSelection;