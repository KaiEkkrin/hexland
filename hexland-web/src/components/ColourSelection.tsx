import { useState } from 'react';

import { hexColours } from '../models/featureColour';

import ButtonGroup from 'react-bootstrap/ButtonGroup';
import ToggleButton from 'react-bootstrap/ToggleButton';

// Use same colours as Bootstrap dark buttons for consistency
const BORDER_UNSELECTED = '#212529';  // dark button default background
const BORDER_HOVER = '#424649';       // dark button hover background
const BORDER_SELECTED = '#0d6efd';    // primary blue when selected
const BORDER_WIDTH = '6px';

interface IColourButtonProps {
  id: string;
  value: number;
  colour: string;  // background colour
  isSelected: boolean;
  onSelect: () => void;
}

// Individual colour button that manages its own hover state
function ColourButton({ id, value, colour, isSelected, onSelect }: IColourButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Border colour: selected always blue, otherwise hover or default
  const borderColour = isSelected ? BORDER_SELECTED
    : isHovered ? BORDER_HOVER
    : BORDER_UNSELECTED;

  const style: React.CSSProperties = {
    '--bs-btn-bg': colour,
    '--bs-btn-border-color': borderColour,
    '--bs-btn-hover-bg': colour,
    '--bs-btn-active-bg': colour,
    '--bs-btn-active-border-color': BORDER_SELECTED,
    borderWidth: BORDER_WIDTH,
    minWidth: '2.5rem',
    minHeight: '2.5rem',
  } as React.CSSProperties;

  return (
    <ToggleButton id={id} type="radio" variant="dark" value={value}
      checked={isSelected}
      onChange={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={style}>
      {/* Empty - button background IS the colour */}
    </ToggleButton>
  );
}

interface INegativeColourProps {
  includeNegative: boolean;
  selectedColour: number;
  setSelectedColour(value: number): void;
}

function NegativeColour(props: INegativeColourProps & { parentId: string }) {
  if (props.includeNegative === false) {
    return null;
  }

  return (
    <ColourButton
      id={`${props.parentId}-neg`}
      value={-1}
      colour="#1a1a1a"
      isSelected={props.selectedColour === -1}
      onSelect={() => props.setSelectedColour(-1)}
    />
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
  const colourButtons = hexColours.map((c, i) => (
    <ColourButton
      key={i}
      id={`${props.id}-${i}`}
      value={i}
      colour={c}
      isSelected={props.selectedColour === i}
      onSelect={() => props.setSelectedColour(i)}
    />
  ));

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
