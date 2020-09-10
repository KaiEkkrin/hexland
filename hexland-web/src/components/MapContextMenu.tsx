import React, { useMemo, useCallback } from 'react';

import { EditMode } from './MapControls'; // TODO remove it from there entirely and prune some?
import { IAnnotation } from '../data/annotation';
import { IToken } from '../data/feature';

import Card from 'react-bootstrap/Card';
import ListGroup from 'react-bootstrap/ListGroup';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlus, faMapMarker, faSquare, faDrawPolygon, faVectorSquare } from '@fortawesome/free-solid-svg-icons';

interface IMapContextMenuItemProps {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent<Element, MouseEvent>) => void;
}

function MapContextMenuItem(props: IMapContextMenuItemProps) {
  return (
    <ListGroup.Item className="Map-info-list-item" action onClick={props.onClick}>
      {props.children}
    </ListGroup.Item>
  );
}

interface IMapContextMenuProps {
  // True if shown, else false.
  show: boolean;
  setShow: (s: boolean) => void;

  // The window co-ordinates where it was opened (so we can position it.)
  x: number;
  y: number;
  pageRight: number;
  pageBottom: number;

  // What was here in the map (if anything)
  token: IToken | undefined;
  note: IAnnotation | undefined;
  editToken: () => void;
  editNote: () => void;

  editMode: EditMode;
  setEditMode: (m: EditMode) => void;
}

// We replace the context menu with this when the map is seen.
function MapContextMenu(props: IMapContextMenuProps) {
  const hidden = useMemo(() => !props.show, [props.show]);
  const tokenLabel = useMemo(() => props.token === undefined ? "Add token" : "Edit token " + props.token.text, [props.token]);
  const noteLabel = useMemo(() => props.note === undefined ? "Add note" : "Edit note", [props.note]);

  const left = useMemo(() => props.x > props.pageRight / 2 ? undefined : props.x, [props.x, props.pageRight]);
  const right = useMemo(() => props.x > props.pageRight / 2 ? props.pageRight - props.x : undefined, [props.x, props.pageRight]);

  const top = useMemo(() => props.y > props.pageBottom / 2 ? undefined : props.y, [props.y, props.pageBottom]);
  const bottom = useMemo(() => props.y > props.pageBottom / 2 ? props.pageBottom - props.y : undefined, [props.y, props.pageBottom]);

  const handleTokenClick = useCallback(() => {
    props.editToken();
    props.setShow(false);
  }, [props]);

  const handleNoteClick = useCallback(() => {
    props.editNote();
    props.setShow(false);
  }, [props]);

  const setAreaMode = useCallback(() => {
    props.setEditMode(EditMode.Area);
    props.setShow(false);
  }, [props]);

  const setWallMode = useCallback(() => {
    props.setEditMode(EditMode.Wall);
    props.setShow(false);
  }, [props]);

  const setRoomMode = useCallback(() => {
    props.setEditMode(EditMode.Room);
    props.setShow(false);
  }, [props]);

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