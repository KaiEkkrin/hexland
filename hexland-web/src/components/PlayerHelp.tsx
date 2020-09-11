import React from 'react';

import ExpansionToggle from './ExpansionToggle';

import Accordion from 'react-bootstrap/Accordion';
import Card from 'react-bootstrap/Card';

import { faMapMarker } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IHelpItemProps {
  children: React.ReactNode;
}

function HelpItem(props: IHelpItemProps) {
  return (
    <Card className="Map-help-card">
      <Card.Header>
        {props.children}
      </Card.Header>
    </Card>
  );
}

interface IExpandingHelpItemProps extends IHelpItemProps {
  eventKey: string;
  summary: React.ReactNode;
  children: React.ReactNode;
}

function ExpandingHelpItem(props: IExpandingHelpItemProps) {
  return (
    <Card className="Map-help-card">
      <ExpansionToggle direction="down" eventKey={props.eventKey}>{props.summary}</ExpansionToggle>
      <Accordion.Collapse eventKey={props.eventKey}>
        <Card.Body>{props.children}</Card.Body>
      </Accordion.Collapse>
    </Card>
  );
}

const playerHelpTitle = (
  <div><b>Drag</b> a token to move it, or an empty space to move the view.</div>
);

const playerHelpBody = (
  <div>
    <b>Shift-drag</b> to select one or more tokens.<br />
    <b>Arrow keys</b> move the currently selected token(s).<br />
    <b>Ctrl-drag</b> an empty space to rotate the map.<br />
    <b>O</b> to move to the currently selected token or map origin.<br />
    <b>Esc</b> to cancel.<br />
      Double-click a note marker <FontAwesomeIcon icon={faMapMarker} color="white" /> to toggle it on or off.
  </div>
);

const basicPlayerHelp = (
  <HelpItem key="p1">
    {playerHelpTitle}
    {playerHelpBody}
  </HelpItem>
);

const ownerHelp = [
  (<ExpandingHelpItem key="p1" eventKey="0" summary={playerHelpTitle}>
    {playerHelpBody}
  </ExpandingHelpItem>),
  (<ExpandingHelpItem key="o1" eventKey="1" summary={(<div><b>Right-click</b> to bring up the context menu.</div>)}>
    The context menu enables you to create and edit tokens and notes, and also switch to one of the paint modes.
    Edit a token to assign it to a player.
  </ExpandingHelpItem>),
  (<ExpandingHelpItem key="o2" eventKey="2" summary={(<div><b>A</b> to start painting an area.</div>)}>
    Paints an area in the currently selected colour.
    While in this mode, <b>drag</b> to paint freehand, or <b>Shift-drag</b> to paint a rectangle.
  </ExpandingHelpItem>),
  (<ExpandingHelpItem key="o3" eventKey="3" summary={(<div><b>W</b> to start painting a wall.</div>)}>
    Paints a wall in the currently selected colour.
    While in this mode, <b>drag</b> to paint freehand, or <b>Shift-drag</b> to paint a wall enclosing a rectangle.
    Players cannot move their tokens through walls.
  </ExpandingHelpItem>),
  (<ExpandingHelpItem key="o4" eventKey="4" summary={(<div><b>R</b> to start painting a room.</div>)}>
    Paints an enclosed room with walls in the currently selected colour.
    While in this mode, <b>drag</b> to combine it with any other room you drag over, or <b>Shift-drag</b> to
    take the area you drag over away from any other existing room.
  </ExpandingHelpItem>),
  (<HelpItem key="o5">
    <b>Del</b> to delete the currently selected token(s).
  </HelpItem>),
];

interface IPlayerHelpProps {
  canDoAnything: boolean;
}

function PlayerHelp(props: IPlayerHelpProps) {
  return props.canDoAnything ? (
    <Accordion defaultActiveKey="0">
      {ownerHelp}
    </Accordion>
  ) : basicPlayerHelp;
}

export default PlayerHelp;