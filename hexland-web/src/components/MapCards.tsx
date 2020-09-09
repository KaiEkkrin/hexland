import React, { useContext, useMemo, useState } from 'react';
import '../App.css';

import { CardStyle } from './AdventureCards';
import ExpansionToggle from './ExpansionToggle';
import { UserContext } from './UserContextProvider';
import { IMapSummary } from '../data/adventure';
import { IAdventureSummary } from '../data/profile';

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

import Measure from 'react-measure';

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
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCard(props: IMapCardProps) {
  const userContext = useContext(UserContext);
  const canDeleteMap = useMemo(
    () => props.deleteMap !== undefined && props.adventures.find(a => a.id === props.map.adventureId)?.owner === userContext.user?.uid,
    [props, userContext]
  );

  return props.collapsing ? (
    <Card bg="dark" text="white" key={props.map.id}>
      <ExpansionToggle eventKey={props.map.id}>{props.map.name}</ExpansionToggle>
      <Accordion.Collapse eventKey={props.map.id}>
        <Card.Body>
          <Card.Subtitle className="text-muted">{props.map.ty as string} map</Card.Subtitle>
          <Card.Text>{props.map.description}</Card.Text>
          <div className="card-footer-spaced">
            <LinkContainer to={"/adventure/" + props.map.adventureId + "/map/" + props.map.id}>
              <Card.Link>Open map</Card.Link>
            </LinkContainer>
            {canDeleteMap ?
              <Button variant="danger" onClick={() => props.deleteMap?.(props.map)}>Delete</Button> :
              <div></div>
            }
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
        {canDeleteMap ?
         <Button variant="danger" onClick={() => props.deleteMap?.(props.map)}>Delete</Button> :
         <div></div>
        }
      </Card.Footer>
    </Card>
  );
}

export interface IMapCardsProps {
  showNewMapCard: boolean;
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  createMap: (() => void) | undefined;
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCards(props: IMapCardsProps) {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const collapsing = useMemo(() => width === undefined || width <= 400, [width]);
  const cards = useMemo(() => {
    const cardList = [...props.maps.map(v => (
      <MapCard collapsing={collapsing} key={v.id} adventures={props.adventures} map={v} deleteMap={props.deleteMap} />
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
  }, [props, collapsing]);

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