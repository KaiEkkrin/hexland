import React from 'react';

import { IAdventureSummary } from './data/profile';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';

interface IAdventureCardsProps {
  adventures: IAdventureSummary[];
  editAdventure: ((id: string) => void) | undefined;
}

function AdventureCards(props: IAdventureCardsProps) {
  return (
    <CardDeck>
      {props.adventures.map((v) =>
        <Card key={v.id}>
          <Card.Body>
            <Card.Title>{v.name}</Card.Title>
            <Card.Text>{v.description}</Card.Text>
            <Card.Link href={"/adventure/" + v.id}>Open</Card.Link>
          </Card.Body>
          {props.editAdventure === undefined ? <div></div> :
            <Button variant="primary" onClick={() => props.editAdventure?.(v.id)}>Edit</Button>
          }
        </Card>
      )}
    </CardDeck>
  );
}

export default AdventureCards;
