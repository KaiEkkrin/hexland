import React, { useMemo, useCallback } from 'react';

import { EditMode } from './MapControls'; // TODO remove it from there entirely and prune some?
import { IAnnotation } from '../data/annotation';
import { ITokenProperties } from '../data/feature';

import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMapMarker, faSquare, faDrawPolygon, faVectorSquare, faArrowsAltH } from '@fortawesome/free-solid-svg-icons';

interface IMapContextMenuItemProps {
  visible?: boolean | undefined;
  children: React.ReactNode;
  onClick: (e: React.MouseEvent<Element, MouseEvent>) => void;
}

function MapContextMenuItem(props: IMapContextMenuItemProps) {
  return props.visible === false ? null : (
    <ListGroup.Item className="Map-info-list-item" action onClick={props.onClick}>
      {props.children}
    </ListGroup.Item>
  );
}

interface IMapContextMenuProps {
  // True if shown, else false.
  show: boolean;
  hide: () => void;

  // The window co-ordinates where it was opened (so we can position it.)
  x: number;
  y: number;
  pageRight: number;
  pageBottom: number;

  // What was here in the map (if anything)
  token: ITokenProperties | undefined;
  note: IAnnotation | undefined;
  editToken: () => void;
  flipToken: () => void;
  editNote: () => void;

  editMode: EditMode;
  setEditMode: (m: EditMode) => void;
}

// We replace the context menu with this when the map is seen.
function MapContextMenu(
  { show, hide, x, y, pageRight, pageBottom, token, note, editToken, flipToken, editNote, editMode, setEditMode }: IMapContextMenuProps
) {
  const hidden = useMemo(() => !show, [show]);
  const tokenLabel = useMemo(() => token === undefined ? "Add token" : "Edit token " + token.text, [token]);
  const showFlipTokenLabel = useMemo(() => token !== undefined && token.size.length > 1, [token]);
  const noteLabel = useMemo(() => note === undefined ? "Add note" : "Edit note", [note]);

  const left = useMemo(() => x > pageRight / 2 ? undefined : x, [x, pageRight]);
  const right = useMemo(() => x > pageRight / 2 ? pageRight - x : undefined, [x, pageRight]);

  const top = useMemo(() => y > pageBottom / 2 ? undefined : y, [y, pageBottom]);
  const bottom = useMemo(() => y > pageBottom / 2 ? pageBottom - y : undefined, [y, pageBottom]);

  const handleTokenClick = useCallback(() => {
    editToken();
    hide();
  }, [editToken, hide]);

  const handleFlipTokenClick = useCallback(() => {
    flipToken();
    hide();
  }, [flipToken, hide]);

  const handleNoteClick = useCallback(() => {
    editNote();
    hide();
  }, [editNote, hide]);

  const setAreaMode = useCallback(() => {
    setEditMode(EditMode.Area);
    hide();
  }, [setEditMode, hide]);

  const setWallMode = useCallback(() => {
    setEditMode(EditMode.Wall);
    hide();
  }, [setEditMode, hide]);

  const setRoomMode = useCallback(() => {
    setEditMode(EditMode.Room);
    hide();
  }, [setEditMode, hide]);

  return (
    <Card bg="dark" text="white" hidden={hidden} style={{
      position: "absolute",
      left: left,
      right: right,
      top: top,
      bottom: bottom,
      zIndex: 2002
    }}>
      <ListGroup variant="flush">
        <MapContextMenuItem onClick={handleTokenClick}>
          <FontAwesomeIcon className="mr-1" icon={faPlus} color="white" />{tokenLabel}
        </MapContextMenuItem>
        <MapContextMenuItem onClick={handleFlipTokenClick} visible={showFlipTokenLabel}>
          <FontAwesomeIcon className="mr-1" icon={faArrowsAltH} color="white" />Flip token
        </MapContextMenuItem>
        <MapContextMenuItem onClick={handleNoteClick}>
          <FontAwesomeIcon className="mr-1" icon={faMapMarker} color="white" />{noteLabel}
        </MapContextMenuItem>
        <MapContextMenuItem onClick={setAreaMode}>
          <FontAwesomeIcon className="mr-1" icon={faSquare} color="white" />Paint <u>a</u>rea
        </MapContextMenuItem>
        <MapContextMenuItem onClick={setWallMode}>
          <FontAwesomeIcon className="mr-1" icon={faDrawPolygon} color="white" />Paint <u>w</u>all
        </MapContextMenuItem>
        <MapContextMenuItem onClick={setRoomMode}>
          <FontAwesomeIcon className="mr-1" icon={faVectorSquare} color="white" />Paint <u>r</u>oom
        </MapContextMenuItem>
      </ListGroup>
    </Card>
  );
}

export default MapContextMenu;