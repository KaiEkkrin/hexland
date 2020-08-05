import React from 'react';

import ColourSelection from './ColourSelection';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faDrawPolygon, faHandPaper, faMousePointer, faPlus, faSearch, faSquare, IconDefinition, faCog } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

export enum EditMode {
  Select = "select",
  Token = "token",
  Area = "area",
  Wall = "wall",
  Pan = "pan",
  Zoom = "zoom",
}

interface IEditModeButtonProps {
  mode: EditMode;
  icon: IconDefinition;
  tooltip: string;
  getEditMode(): EditMode;
  setEditMode(value: EditMode): void;
}

function EditModeButton(props: IEditModeButtonProps) {
  return (
    <OverlayTrigger key={props.mode} placement="right" overlay={
      <Tooltip id={props.mode + "-tooltip"}>{props.tooltip}</Tooltip>
    }>
      <ToggleButton type="radio" variant="dark" key={props.mode} value={props.mode}
        checked={props.getEditMode() === props.mode}
        onChange={e => props.setEditMode(props.mode)}>
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
  canOpenMapEditor: boolean;
  openMapEditor(): void;
}

function MapControls(props: IMapControlsProps) {
  return (
    <div className="Map-controls bg-dark">
      <ButtonGroup className="mb-2" toggle vertical>
        <EditModeButton mode={EditMode.Select} icon={faMousePointer} tooltip="Select and move tokens"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Token} icon={faPlus} tooltip="Add and edit tokens"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Area} icon={faSquare} tooltip="Paint areas"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Wall} icon={faDrawPolygon} tooltip="Paint walls"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Pan} icon={faHandPaper} tooltip="Pan the map view"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
        <EditModeButton mode={EditMode.Zoom} icon={faSearch} tooltip="Zoom the map view, or Shift-click to rotate"
          getEditMode={props.getEditMode} setEditMode={props.setEditMode} />
      </ButtonGroup>
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
      {props.canOpenMapEditor ?
        <ButtonGroup className="mt-2">
          <OverlayTrigger placement="right" overlay={
            <Tooltip id="reset-tooltip">Open map settings</Tooltip>
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