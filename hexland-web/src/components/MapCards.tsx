import React, { useContext, useMemo } from 'react';
import '../App.css';

import { UserContext } from './UserContextProvider';
import { IMapSummary } from '../data/adventure';
import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

interface IMapCardProps {
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

  return (
    <Card className="mt-4" style={{ minWidth: '18rem' }}
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
  newMapCard: JSX.Element | undefined;
  adventures: IAdventureSummary[];
  maps: IMapSummary[];
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCards(props: IMapCardsProps) {
  return (
    <CardDeck>
      {props.newMapCard}
      {props.maps.map((v) => (
        <MapCard key={v.id} adventures={props.adventures} map={v} deleteMap={props.deleteMap} />
      ))}
    </CardDeck>
  );
}

export default MapCards;