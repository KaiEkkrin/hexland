import React, { useMemo } from 'react';

import ColourSelection from './ColourSelection';
import { ShowAnnotationFlags } from './MapAnnotations';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faDrawPolygon, faMousePointer, faPlus, faSquare, IconDefinition, faCog, faSuitcase, faMapMarker, faVectorSquare } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum EditMode {
  Select = "select",
  Token = "token",
  Notes = "notes",
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
  editMode: EditMode;
  setEditMode(value: EditMode): void;
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
  const modeButtons = useMemo(() => {
    var buttons = [
      <ModeButton key={EditMode.Select} value={EditMode.Select} icon={faMousePointer}
        mode={props.editMode} setMode={props.setEditMode}
      >
        <u>S</u>elect and move tokens
      </ModeButton>
    ];

    if (props.canDoAnything) {
      buttons.push(...[
        <ModeButton key={EditMode.Token} value={EditMode.Token} icon={faPlus}
          mode={props.editMode} setMode={props.setEditMode}
        >
          Add and edit <u>t</u>okens
        </ModeButton>,
        <ModeButton key={EditMode.Notes} value={EditMode.Notes} icon={faMapMarker}
          mode={props.editMode} setMode={props.setEditMode}
        >
          Add and edit map <u>n</u>otes
        </ModeButton>,
        <ModeButton key={EditMode.Area} value={EditMode.Area} icon={faSquare}
          mode={props.editMode} setMode={props.setEditMode}
        >
          Paint <u>a</u>reas.  Shift-drag to paint rectangular areas.
        </ModeButton>,
        <ModeButton key={EditMode.Wall} value={EditMode.Wall} icon={faDrawPolygon}
          mode={props.editMode} setMode={props.setEditMode}
        >
          Paint <u>w</u>alls.  Shift-drag to paint rectangles of walls.
        </ModeButton>,
        <ModeButton key={EditMode.Room} value={EditMode.Room} icon={faVectorSquare}
          mode={props.editMode} setMode={props.setEditMode}
        >
          Paint the union of <u>r</u>ooms.  Shift-drag to paint the difference of rooms.
        </ModeButton>
      ]);
    }

    return buttons;
  }, [props.canDoAnything, props.editMode, props.setEditMode]);

  const hideExtraControls = useMemo(() => !props.canDoAnything, [props.canDoAnything]);
  const isNotOwner = useMemo(() => !props.isOwner, [props.isOwner]);

  return (
    <div className="Map-controls">
      <ButtonGroup className="Map-control" toggle vertical>{modeButtons}</ButtonGroup>
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