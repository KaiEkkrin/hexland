import React from 'react';
import './App.css';

import { IMapSummary } from './data/adventure';

import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

export interface IMapCardsProps {
  maps: IMapSummary[];
  editMap: ((map: IMapSummary) => void) | undefined;
  deleteMap: ((map: IMapSummary) => void) | undefined;
}

function MapCards(props: IMapCardsProps) {
  return (
    <CardDeck>
      {props.maps.map((v) =>
        <Card bg="dark" text="white" key={v.id}>
          <Card.Body>
            <Card.Title>{v.name}</Card.Title>
            <Card.Subtitle className="text-muted">{v.ty as string} map</Card.Subtitle>
            <Card.Text>{v.description}</Card.Text>
          </Card.Body>
          <Card.Footer>
            <LinkContainer to={"/map/" + v.id}>
              <Card.Link>Open</Card.Link>
            </LinkContainer>
          </Card.Footer>
          <ButtonGroup>
            {props.editMap === undefined ? <div></div> :
              <Button variant="primary" onClick={() => props.editMap?.(v)}>Edit</Button>
            }
            {props.deleteMap === undefined ? <div></div> :
              <Button variant="danger" onClick={() => props.deleteMap?.(v)}>Delete</Button>
            }
          </ButtonGroup>
        </Card>
      )}
    </CardDeck>
  );
}

export default MapCards;