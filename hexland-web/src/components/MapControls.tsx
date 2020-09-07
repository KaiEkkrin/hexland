import React, { useMemo } from 'react';

import ColourSelection from './ColourSelection';
import { ShowAnnotationFlags } from './MapAnnotations';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faSquare, IconDefinition, faCog, faSuitcase, faMapMarker } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum EditMode {
  Select = "select",
  Area = "area",
  Wall = "wall",
  Room = "room",
}

export enum MapColourVisualisationMode {
  Areas = "areas",
  Connectivity = "connectivity"
}

// We make the children the tooltip contents, to allow for convenient formatting
interface IModeButtonProps<T> {
  value: T; // the value of this button
  icon: IconDefinition;
  children: React.ReactNode;
  mode: T; // the currently selected mode
  setMode(value: T): void;
}

function ModeButton<T>(props: IModeButtonProps<T>) {
  return (
    <OverlayTrigger placement="right" overlay={
      <Tooltip id={props.value + "-tooltip"}>{props.children}</Tooltip>
    }>
      <ToggleButton type="radio" variant="dark" value={props.value}
        checked={props.mode === props.value}
        onChange={e => props.setMode(props.value)}>
        <FontAwesomeIcon icon={props.icon} color="white" />
      </ToggleButton>
    </OverlayTrigger>
  );
}

interface IMapControlsProps {
  selectedColour: number;
  setSelectedColour(value: number): void;
  resetView(): void;
  mapColourVisualisationMode: MapColourVisualisationMode;
  setMapColourVisualisationMode(mode: MapColourVisualisationMode): void;
  canDoAnything: boolean;
  isOwner: boolean;
  openMapEditor(): void;
  setShowAnnotationFlags(flags: ShowAnnotationFlags): void;
}

function MapControls(props: IMapControlsProps) {
  const hideExtraControls = useMemo(() => !props.canDoAnything, [props.canDoAnything]);
  const isNotOwner = useMemo(() => !props.isOwner, [props.isOwner]);

  return (
    <div className="Map-controls">
      <ButtonGroup className="Map-control" vertical>
        <OverlayTrigger placement="right" overlay={
          <Tooltip id="reset-tooltip">Reset the map view to <u>o</u>rigin</Tooltip>
        }>
          <Button variant="dark" onClick={() => props.resetView()}>
            <FontAwesomeIcon icon={faDotCircle} color="white" />
          </Button>
        </OverlayTrigger>
        <Dropdown as={ButtonGroup} drop="right">
          <Dropdown.Toggle variant="dark">
            <FontAwesomeIcon icon={faMapMarker} color="white" />
          </Dropdown.Toggle>
          <Dropdown.Menu>
          <Dropdown.Item onClick={() => props.setShowAnnotationFlags(ShowAnnotationFlags.None)}>No notes visible</Dropdown.Item>
          <Dropdown.Item onClick={() => props.setShowAnnotationFlags(ShowAnnotationFlags.MapNotes)}>Map notes only</Dropdown.Item>
          <Dropdown.Item onClick={() => props.setShowAnnotationFlags(ShowAnnotationFlags.TokenNotes)}>Token notes only</Dropdown.Item>
          <Dropdown.Item onClick={() => props.setShowAnnotationFlags(ShowAnnotationFlags.All)}>All notes visible</Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown>
      </ButtonGroup>
      <ColourSelection className="Map-control" id="mapColourSelect"
        hidden={hideExtraControls}
        includeNegative={true}
        isVertical={true}
        selectedColour={props.selectedColour}
        setSelectedColour={props.setSelectedColour} />
      <ButtonGroup className="Map-control" hidden={hideExtraControls} toggle vertical>
        <ModeButton value={MapColourVisualisationMode.Areas} icon={faSquare}
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode}
        >Show painted area colours</ModeButton>
        <ModeButton value={MapColourVisualisationMode.Connectivity} icon={faSuitcase}
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode}
        >Show each room in a different colour</ModeButton>
      </ButtonGroup>
      <ButtonGroup className="Map-control" hidden={isNotOwner} vertical>
        <OverlayTrigger placement="right" overlay={
          <Tooltip id="map-editor-tooltip">Open map settings</Tooltip>
        }>
          <Button variant="dark" onClick={() => props.openMapEditor()}>
            <FontAwesomeIcon icon={faCog} color="white" />
          </Button>
        </OverlayTrigger>
      </ButtonGroup>
    </div>
  );
}

export default MapControls;