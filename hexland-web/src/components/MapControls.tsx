import React, { useMemo } from 'react';

import ColourSelection from './ColourSelection';
import { ShowAnnotationFlags } from './MapAnnotations';
import { IPlayer } from '../data/adventure';
import { IMap } from '../data/map';
import { hexColours } from '../models/featureColour';

import Badge from 'react-bootstrap/Badge';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Dropdown from 'react-bootstrap/Dropdown';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import ToggleButton from 'react-bootstrap/ToggleButton';
import Tooltip from 'react-bootstrap/Tooltip';

import { faDotCircle, faDrawPolygon, faHandPaper, faMousePointer, faPlus, faSearch, faSquare, IconDefinition, faCog, faSuitcase, faMapMarker, faUsers } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { IToken } from '../data/feature';

import fluent from 'fluent-iterable';

// A quick utility function for figuring out whether a player has any
// tokens assigned to them so we can show status.
// Returns undefined for the owner, who is a special case (we don't care.)
function hasAnyTokens(map: IMap | undefined, player: IPlayer, tokens: IToken[]) {
  if (player.playerId === map?.owner) {
    return undefined;
  }

  return fluent(tokens).any(
    t => t.players.find(pId => pId === player.playerId) !== undefined
  );
}

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

interface IPlayerDropdownItemProps {
  map: IMap | undefined;
  player: IPlayer;
  tokens: IToken[];
}

function PlayerDropdownItem(props: IPlayerDropdownItemProps) {
  const myTokens = useMemo(
    () => props.tokens.filter(t => t.players.find(p => p === props.player.playerId) !== undefined),
    [props.player, props.tokens]
  );

  const isNoTokenHidden = useMemo(
    () => props.player.playerId === props.map?.owner,
    [props.map, props.player]
  );

  return (
    <Dropdown.Item>
      {props.player.playerName}
      {myTokens.length > 0 ? myTokens.map(t => (
        <Badge className="ml-2" style={{ backgroundColor: hexColours[t.colour] }}>{t.text}</Badge>
      )) : (
        <Badge className="ml-2" hidden={isNoTokenHidden} variant="danger">Click to assign this player a token</Badge>
      )}
    </Dropdown.Item>
  )
}

interface IMapControlsProps {
  map: IMap | undefined;
  editMode: EditMode;
  setEditMode(value: EditMode): void;
  selectedColour: number;
  setSelectedColour(value: number): void;
  resetView(): void;
  mapColourVisualisationMode: MapColourVisualisationMode;
  setMapColourVisualisationMode(mode: MapColourVisualisationMode): void;
  canDoAnything: boolean;
  canOpenMapEditor: boolean;
  openMapEditor(): void;
  setShowAnnotationFlags(flags: ShowAnnotationFlags): void;
  players: IPlayer[];
  tokens: IToken[];
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

  const numberOfPlayersWithNoTokens = useMemo(
    () => fluent(props.players).filter(p => hasAnyTokens(props.map, p, props.tokens) === false).count(),
    [props.map, props.players, props.tokens]
  );

  const hideNumberOfPlayersWithNoTokens = useMemo(
    () => numberOfPlayersWithNoTokens === 0,
    [numberOfPlayersWithNoTokens]
  );

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
        includeNegative={true}
        isVertical={true}
        selectedColour={props.selectedColour}
        setSelectedColour={props.setSelectedColour} />
      <ButtonGroup className="mt-2" toggle vertical>
        <ModeButton value={MapColourVisualisationMode.Areas} icon={faSquare} tooltip="Show area colours"
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
        <ModeButton value={MapColourVisualisationMode.Connectivity} icon={faSuitcase}
          tooltip="Show map connectivity colours"
          mode={props.mapColourVisualisationMode} setMode={props.setMapColourVisualisationMode} />
      </ButtonGroup>
      {props.canOpenMapEditor ?
        <ButtonGroup className="mt-2" vertical>
          <Dropdown as={ButtonGroup} drop="right">
            <Dropdown.Toggle variant="dark">
              <div>
                <FontAwesomeIcon icon={faUsers} color="white" />
                <Badge className="Map-min ml-1" hidden={hideNumberOfPlayersWithNoTokens} variant="danger">
                  {numberOfPlayersWithNoTokens}
                </Badge>
              </div>
            </Dropdown.Toggle>
            <Dropdown.Menu>
              {props.players.filter(p => p.playerId !== props.map?.owner).map(p => (
                <PlayerDropdownItem key={p.playerId} map={props.map} player={p} tokens={props.tokens} />
              ))}
            </Dropdown.Menu>
          </Dropdown>
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