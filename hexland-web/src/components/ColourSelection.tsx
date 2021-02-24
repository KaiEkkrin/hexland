import { hexColours } from '../models/featureColour';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

import { faSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface INegativeColourProps {
  includeNegative: boolean;
  selectedColour: number;
  setSelectedColour(value: number): void;
}

function NegativeColour(props: INegativeColourProps) {
  if (props.includeNegative === false) {
    return null;
  }

  return (
    <ToggleButton type="radio" variant="dark" key={-1} value={-1}
      checked={props.selectedColour === -1}
      onChange={(e) => props.setSelectedColour(-1)}>
      <FontAwesomeIcon icon={faSquare} color="black" />
    </ToggleButton>
  );
}

interface IColourSelectionProps {
  className?: string | undefined;
  hidden: boolean;
  id: string;
  includeNegative: boolean;
  isVertical: boolean;
  selectedColour: number;
  setSelectedColour(value: number): void;
}

function ColourSelection(props: IColourSelectionProps) {
  return (
    <ButtonGroup className={props.className} id={props.id} hidden={props.hidden} toggle vertical={props.isVertical === true}>
      {hexColours.map((c, i) =>
        <ToggleButton type="radio" variant="dark" key={i} value={i}
          checked={props.selectedColour === i}
          onChange={e => props.setSelectedColour(i)}>
          <FontAwesomeIcon icon={faSquare} color={c} />
        </ToggleButton>
      )}
      <NegativeColour includeNegative={props.includeNegative}
        selectedColour={props.selectedColour}
        setSelectedColour={props.setSelectedColour} />
    </ButtonGroup>
  );
}

export default ColourSelection;