import React, { useMemo } from 'react';

import ColourSelection from './ColourSelection';
import { ShowAnnotationFlags } from './MapAnnotations';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faDrawPolygon, faHandPaper, faMousePointer, faPlus, faSearch, faSquare, IconDefinition, faCog, faSuitcase, faMapMarker } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum EditMode {
  Select = "select",
  Token = "token",
  Notes = "notes",
  Area = "area",
  Wall = "wall",
  Pan = "pan",
  Zoom = "zoom",
}

export enum MapColourVisualisationMode {
  Areas = "areas",
  Connectivity = "connectivity"
}

interface IModeButtonProps<T> {
  value: T; // the value of this button
  icon: IconDefinition;
  tooltip: string;
  mode: T; // the currently selected mode
  setMode(value: T): void;
}

function ModeButton<T>(props: IModeButtonProps<T>) {
  return (
    <OverlayTrigger placement="right" overlay={
      <Tooltip id={props.value + "-tooltip"}>{props.tooltip}</Tooltip>
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
        tooltip="Select and move tokens" mode={props.editMode} setMode={props.setEditMode} />
    ];

    if (props.canDoAnything) {
      buttons.push(...[
        <ModeButton key={EditMode.Token} value={EditMode.Token} icon={faPlus} tooltip="Add and edit tokens"
          mode={props.editMode} setMode={props.setEditMode} />,
        <ModeButton key={EditMode.Notes} value={EditMode.Notes} icon={faMapMarker} tooltip="Add and edit map notes"
          mode={props.editMode} setMode={props.setEditMode} />,
        <ModeButton key={EditMode.Area} value={EditMode.Area} icon={faSquare} tooltip="Paint areas"
          mode={props.editMode} setMode={props.setEditMode} />,
        <ModeButton key={EditMode.Wall} value={EditMode.Wall} icon={faDrawPolygon} tooltip="Paint walls"
          mode={props.editMode} setMode={props.setEditMode} />
      ]);
    }

    buttons.push(...[
      <ModeButton key={EditMode.Pan} value={EditMode.Pan} icon={faHandPaper} tooltip="Pan the map view"
        mode={props.editMode} setMode={props.setEditMode} />,
      <ModeButton key={EditMode.Zoom} value={EditMode.Zoom} icon={faSearch} tooltip="Zoom the map view, or Shift-click to rotate"
        mode={props.editMode} setMode={props.setEditMode} />
    ]);

    return buttons;
  }, [props.canDoAnything, props.editMode, props.setEditMode]);

  const hideExtraControls = useMemo(() => !props.canDoAnything, [props.canDoAnything]);
  const isNotOwner = useMemo(() => !props.isOwner, [props.isOwner]);

  return (
    <div className="Map-controls bg-dark">
      <ButtonGroup className="mb-2" toggle vertical>{modeButtons}</ButtonGroup>
      <ButtonGroup className="mb-2" vertical>
        <OverlayTrigger placement="right" overlay={
          <Tooltip id="reset-tooltip">Reset the map view</Tooltip>
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
      <ColourSelection id="mapColourSelect"
        hidden={hideExtraControls}
        includeNegative={true}
        isVertical={true}
        selectedColour={props.selectedColour}
        setSelectedColour={props.setSelectedColour} />
      <ButtonGroup className="mt-2" hidden={hideExtraControls} toggle vertical>
        <ModeButton value={MapColourVisualisationMode.Areas} icon={faSquare} tooltip="Show area colours"
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
        <ModeButton value={MapColourVisualisationMode.Connectivity} icon={faSuitcase}
          tooltip="Show map connectivity colours"
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
      </ButtonGroup>
      <ButtonGroup className="mt-2" hidden={isNotOwner} vertical>
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