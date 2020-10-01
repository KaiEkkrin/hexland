import React, { useContext, useMemo, useState } from 'react';
import '../App.css';

import { CardStyle } from './AdventureCards';
import ExpansionToggle from './ExpansionToggle';
import { UserContext } from './UserContextProvider';
import { IMapSummary } from '../data/adventure';
import { IAdventureSummary } from '../data/profile';

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import OverlayTrigger from 'react-bootstrap/OverlayTrigger';
import Tooltip from 'react-bootstrap/Tooltip';

import Measure from 'react-measure';
import { LinkContainer } from 'react-router-bootstrap';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCopy, faTimes } from '@fortawesome/free-solid-svg-icons';

interface INewMapCardProps {
  collapsing: boolean;
  handleNewMapClick: (() => void) | undefined;
}

function NewMapCard(props: INewMapCardProps) {
  return props.collapsing ? (
    <Card bg="dark" text="white">
      <Card.Header>
        <Button onClick={() => props.handleNewMapClick?.()}>New map</Button>
      </Card.Header>
    </Card>
  ) : (
    <Card className="mt-4" style={CardStyle} bg="dark" text="white">
      <Card.Body>
        <Button onClick={() => props.handleNewMapClick?.()}>New map</Button>
      </Card.Body>
    </Card>
  );
}

interface IMapCardProps {
  collapsing: boolean;
  adventures: IAdventureSummary[];
  map: IMapSummary;
  cloneMap: ((map: IMapSummary) => void) | undefined;
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCard(props: IMapCardProps) {
  const userContext = useContext(UserContext);
  const cloneMapButton = useMemo(() => {
    const key = "clone-" + props.map.id;
    return props.cloneMap === undefined ? undefined : (
      <OverlayTrigger key={key} placement="top" overlay={
        <Tooltip id={key + "-tooltip"}>Clone map</Tooltip>
      }>
        <Button variant="secondary" onClick={() => props.cloneMap?.(props.map)}>
          <FontAwesomeIcon icon={faCopy} color="white" />
        </Button>
      </OverlayTrigger>
    );
  }, [props]);

  const deleteMapButton = useMemo(() => {
    const key = "delete-" + props.map.id;
    return props.deleteMap === undefined ? undefined : (
      <OverlayTrigger key={key} placement="top" overlay={
        <Tooltip id={key + "-tooltip"}>Delete map</Tooltip>
      }>
        <Button variant="danger" onClick={() => props.deleteMap?.(props.map)}>
          <FontAwesomeIcon icon={faTimes} color="white" />
        </Button>
      </OverlayTrigger>
    );
  }, [props]);

  const manageButtons = useMemo(() => {
    if (props.adventures.find(a => a.id === props.map.adventureId)?.owner !== userContext.user?.uid) {
      // We don't own this adventure, so we can't manage the map
      return undefined;
    }

    const buttons = [cloneMapButton, deleteMapButton]
      .filter(b => b !== undefined);
    return buttons.length === 0 ? undefined : (
      <ButtonGroup>
        {buttons}
      </ButtonGroup>
    );
  }, [cloneMapButton, deleteMapButton, props.adventures, props.map, userContext]);

  return props.collapsing ? (
    <Card bg="dark" text="white" key={props.map.id}>
      <ExpansionToggle direction="down" eventKey={props.map.id}>{props.map.name}</ExpansionToggle>
      <Accordion.Collapse eventKey={props.map.id}>
        <Card.Body>
          <Card.Subtitle className="text-muted">{props.map.ty as string} map</Card.Subtitle>
          <Card.Text>{props.map.description}</Card.Text>
          <div className="card-footer-spaced">
            <LinkContainer to={"/adventure/" + props.map.adventureId + "/map/" + props.map.id}>
              <Card.Link>Open map</Card.Link>
            </LinkContainer>
            {manageButtons}
          </div>
        </Card.Body>
      </Accordion.Collapse>
    </Card>
  ) : (
    <Card className="mt-4" style={CardStyle}
      bg="dark" text="white" key={props.map.id}>
      <Card.Body>
        <Card.Title>{props.map.name}</Card.Title>
        <Card.Subtitle className="text-muted">{props.map.ty as string} map</Card.Subtitle>
        <Card.Text>{props.map.description}</Card.Text>
      </Card.Body>
      <Card.Footer className="card-footer-spaced">
        <LinkContainer to={"/adventure/" + props.map.adventureId + "/map/" + props.map.id}>
          <Card.Link>Open map</Card.Link>
        </LinkContainer>
        {manageButtons}
      </Card.Footer>
    </Card>
  );
}

export interface IMapCardsProps {
  showNewMapCard: boolean;
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  createMap: (() => void) | undefined;
  cloneMap: ((map: IMapSummary) => void) | undefined;
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCards(props: IMapCardsProps) {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const collapsing = useMemo(() => width === undefined || width <= 400, [width]);

  // don't offer the option to clone a map if we wouldn't offer the option of a new map
  const cloneMap = useMemo(() => props.showNewMapCard ? props.cloneMap : undefined, [props]);
  const cards = useMemo(() => {
    const cardList = [...props.maps.map(v => (
      <MapCard collapsing={collapsing} key={v.id} adventures={props.adventures} map={v}
        cloneMap={cloneMap} deleteMap={props.deleteMap} />
    ))];

    if (props.showNewMapCard && props.createMap !== undefined) {
      cardList.splice(0, 0, (
        <NewMapCard collapsing={collapsing} key="new" handleNewMapClick={props.createMap} />
      ));
    }

    return collapsing ? (
      <Accordion className="mt-4">
        {cardList}
      </Accordion>
    ) : (
      <CardDeck>
        {cardList}
      </CardDeck>
    );
  }, [props, cloneMap, collapsing]);

  return (
    <Measure bounds onResize={r => setWidth(r.bounds?.width)}>
      {({ measureRef }) => (
        <div ref={measureRef}>
          {cards}
        </div>
      )}
    </Measure>
  );
}

export default MapCards;