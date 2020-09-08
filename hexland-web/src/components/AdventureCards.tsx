import React from 'react';
import '../App.css';

import { IAdventureSummary } from '../data/profile';

import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

export const CardStyle: React.CSSProperties = {
  minWidth: '16rem', maxWidth: '24rem'
};

interface IAdventureCardsProps {
  newAdventureCard: JSX.Element | undefined;
  adventures: IAdventureSummary[];
}

function AdventureCards(props: IAdventureCardsProps) {
  return (
    <CardDeck>
      {props.newAdventureCard}
      {props.adventures.map((v) =>
        <Card className="mt-4" style={CardStyle}
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
        </Card>
      )}
    </CardDeck>
  );
}

export default AdventureCards;
