import React from 'react';
import '../App.css';

import { IAdventureSummary } from '../data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

interface IAdventureCardsProps {
  newAdventureCard: JSX.Element;
  adventures: IAdventureSummary[];
  canEditAdventure: (adventure: IAdventureSummary) => boolean;
  editAdventure: ((id: string) => void) | undefined;
}

function AdventureCards(props: IAdventureCardsProps) {
  return (
    <CardDeck>
      {props.newAdventureCard}
      {props.adventures.map((v) =>
        <Card className="mt-4" style={{ minWidth: '16rem', maxWidth: '16rem' }}
          bg="dark" text="white" key={v.id}>
          <Card.Body>
            <Card.Title>{v.name}</Card.Title>
            <Card.Subtitle>By {v.ownerName}</Card.Subtitle>
            <Card.Text>{v.description}</Card.Text>
          </Card.Body>
          <Card.Footer>
            <LinkContainer to={"/adventure/" + v.id}>
              <Card.Link>Open adventure</Card.Link>
            </LinkContainer>
          </Card.Footer>
          {props.editAdventure === undefined || !props.canEditAdventure(v) ? <div></div> :
            <Button variant="primary" onClick={() => props.editAdventure?.(v.id)}>Edit</Button>
          }
        </Card>
      )}
    </CardDeck>
  );
}

export default AdventureCards;
