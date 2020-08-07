import React from 'react';

import ColourSelection from './ColourSelection';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faDrawPolygon, faHandPaper, faMousePointer, faPlus, faSearch, faSquare, IconDefinition, faCog, faSuitcase } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum EditMode {
  Select = "select",
  Token = "token",
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
  mode: T;
  icon: IconDefinition;
  tooltip: string;
  getMode(): T;
  setMode(value: T): void;
}

function ModeButton<T>(props: IModeButtonProps<T>) {
  return (
    <OverlayTrigger placement="right" overlay={
      <Tooltip id={props.mode + "-tooltip"}>{props.tooltip}</Tooltip>
    }>
      <ToggleButton type="radio" variant="dark" value={props.mode}
        checked={props.getMode() === props.mode}
        onChange={e => props.setMode(props.mode)}>
        <FontAwesomeIcon icon={props.icon} color="white" />
      </ToggleButton>
    </OverlayTrigger>
  );
}

interface IMapControlsProps {
  colours: string[];
  getEditMode(): EditMode;
  setEditMode(value: EditMode): void;
  getSelectedColour(): number;
  setSelectedColour(value: number): void;
  resetView(): void;
  getMapColourVisualisationMode(): MapColourVisualisationMode;
  setMapColourVisualisationMode(mode: MapColourVisualisationMode): void;
  canDoAnything: boolean;
  canOpenMapEditor: boolean;
  openMapEditor(): void;
}

function MapControls(props: IMapControlsProps) {
  function createModeButtons() {
    var buttons = [
      <ModeButton key={EditMode.Select} mode={EditMode.Select} icon={faMousePointer}
        tooltip="Select and move tokens" getMode={props.getEditMode} setMode={props.setEditMode} />
    ];

    if (props.canDoAnything) {
      buttons.push(...[
        <ModeButton key={EditMode.Token} mode={EditMode.Token} icon={faPlus} tooltip="Add and edit tokens"
          getMode={props.getEditMode} setMode={props.setEditMode} />,
        <ModeButton key={EditMode.Area} mode={EditMode.Area} icon={faSquare} tooltip="Paint areas"
          getMode={props.getEditMode} setMode={props.setEditMode} />,
        <ModeButton key={EditMode.Wall} mode={EditMode.Wall} icon={faDrawPolygon} tooltip="Paint walls"
          getMode={props.getEditMode} setMode={props.setEditMode} />
      ]);
    }

    buttons.push(...[
      <ModeButton key={EditMode.Pan} mode={EditMode.Pan} icon={faHandPaper} tooltip="Pan the map view"
        getMode={props.getEditMode} setMode={props.setEditMode} />,
      <ModeButton key={EditMode.Zoom} mode={EditMode.Zoom} icon={faSearch} tooltip="Zoom the map view, or Shift-click to rotate"
        getMode={props.getEditMode} setMode={props.setEditMode} />
    ]);

    return buttons;
  }

  return (
    <div className="Map-controls bg-dark">
      <ButtonGroup className="mb-2" toggle vertical>{createModeButtons()}</ButtonGroup>
      <ButtonGroup className="mb-2">
        <OverlayTrigger placement="right" overlay={
          <Tooltip id="reset-tooltip">Reset the map view</Tooltip>
        }>
          <Button variant="dark" onClick={() => props.resetView()}>
            <FontAwesomeIcon icon={faDotCircle} color="white" />
          </Button>
        </OverlayTrigger>
      </ButtonGroup>
      <ColourSelection colours={props.colours}
        includeNegative={true}
        isVertical={true}
        getSelectedColour={props.getSelectedColour}
        setSelectedColour={props.setSelectedColour} />
      <ButtonGroup className="mt-2" toggle vertical>
        <ModeButton mode={MapColourVisualisationMode.Areas} icon={faSquare} tooltip="Show area colours"
          getMode={props.getMapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
        <ModeButton mode={MapColourVisualisationMode.Connectivity} icon={faSuitcase}
          tooltip="Show map connectivity colours"
          getMode={props.getMapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
      </ButtonGroup>
      {props.canOpenMapEditor ?
        <ButtonGroup className="mt-2" vertical>
          <OverlayTrigger placement="right" overlay={
            <Tooltip id="map-editor-tooltip">Open map settings</Tooltip>
          }>
            <Button variant="dark" onClick={() => props.openMapEditor()}>
              <FontAwesomeIcon icon={faCog} color="white" />
            </Button>
          </OverlayTrigger>
        </ButtonGroup> : <div></div>}
    </div>
  );
}

export default MapControls;