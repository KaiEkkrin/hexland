import { hexColours } from '../models/featureColour';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

// Bootstrap's default dark button colours for border toggle indication
const BORDER_UNSELECTED = '#495057';  // darker grey when not selected
const BORDER_SELECTED = '#0d6efd';    // primary blue when selected
const BORDER_WIDTH = '6px';

interface INegativeColourProps {
  includeNegative: boolean;
  selectedColour: number;
  setSelectedColour(value: number): void;
}

function NegativeColour(props: INegativeColourProps & { parentId: string }) {
  if (props.includeNegative === false) {
    return null;
  }

  const isSelected = props.selectedColour === -1;
  const borderColour = isSelected ? BORDER_SELECTED : BORDER_UNSELECTED;

  // Black/erase button - dark interior, border shows selection state
  const style: React.CSSProperties = {
    '--bs-btn-bg': '#1a1a1a',
    '--bs-btn-border-color': borderColour,
    '--bs-btn-hover-bg': '#1a1a1a',
    '--bs-btn-hover-border-color': BORDER_SELECTED,
    '--bs-btn-active-bg': '#1a1a1a',
    '--bs-btn-active-border-color': BORDER_SELECTED,
    borderWidth: BORDER_WIDTH,
    minWidth: '2.5rem',
    minHeight: '2.5rem',
  } as React.CSSProperties;

  return (
    <ToggleButton id={`${props.parentId}-neg`} type="radio" variant="dark" key={-1} value={-1}
      checked={isSelected}
      onChange={(_e) => props.setSelectedColour(-1)}
      style={style}>
      {/* Empty - button background IS the colour */}
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
  // Generate buttons with coloured interior and border that indicates selection
  const colourButtons = hexColours.map((c, i) => {
    const isSelected = props.selectedColour === i;
    const borderColour = isSelected ? BORDER_SELECTED : BORDER_UNSELECTED;

    const style: React.CSSProperties = {
      '--bs-btn-bg': c,
      '--bs-btn-border-color': borderColour,
      '--bs-btn-hover-bg': c,  // Keep same colour on hover
      '--bs-btn-hover-border-color': BORDER_SELECTED,
      '--bs-btn-active-bg': c,  // Keep same colour when active
      '--bs-btn-active-border-color': BORDER_SELECTED,
      borderWidth: BORDER_WIDTH,
      minWidth: '2.5rem',
      minHeight: '2.5rem',
    } as React.CSSProperties;

    return (
      <ToggleButton id={`${props.id}-${i}`} type="radio" variant="dark" key={i} value={i}
        checked={isSelected}
        onChange={_e => props.setSelectedColour(i)}
        style={style}>
        {/* Empty - button background IS the colour */}
      </ToggleButton>
    );
  });

  return (
    <ButtonGroup className={props.className} id={props.id} hidden={props.hidden} vertical={props.isVertical === true}>
      {colourButtons}
      <NegativeColour parentId={props.id} includeNegative={props.includeNegative}
        selectedColour={props.selectedColour}
        setSelectedColour={props.setSelectedColour} />
    </ButtonGroup>
  );
}

export default ColourSelection;
