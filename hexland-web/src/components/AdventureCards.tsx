import React, { useMemo, useState } from 'react';
import '../App.css';

import ExpansionToggle from './ExpansionToggle';
import { IAdventureSummary } from '../data/profile';

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';
import { LinkContainer } from 'react-router-bootstrap';

import Measure from 'react-measure';

export const CardStyle: React.CSSProperties = {
  minWidth: '16rem', maxWidth: '24rem'
};

function AdventureCardsCollapsing(props: IAdventureCardsProps) {
  const cards = useMemo(() => {
    const cardList = [...props.adventures.map(v => (
      <Card key={v.id} bg="dark" text="white">
        <ExpansionToggle direction="down" eventKey={v.id}>{v.name}</ExpansionToggle>
        <Accordion.Collapse eventKey={v.id}>
          <Card.Body>
            <Card.Subtitle>By {v.ownerName}</Card.Subtitle>
            <Card.Text>{v.description}</Card.Text>
            <LinkContainer to={"/adventure/" + v.id}>
              <Card.Link>Open adventure</Card.Link>
            </LinkContainer>
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    ))];

    if (props.showNewAdventureCard) {
      cardList.splice(0, 0, (
        <Card bg="dark" text="white" key="new">
          <Card.Header>
            <Button onClick={props.handleCreate}>New adventure</Button>
          </Card.Header>
        </Card>
      ));
    }

    return cardList;
  }, [props]);

  return (
    <Accordion className="mt-4">
      {cards}
    </Accordion>
  );
}

function AdventureCardsLarge(props: IAdventureCardsProps) {
  const cards = useMemo(() => {
    const cardList = [...props.adventures.map(v => (
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
    ))];

    if (props.showNewAdventureCard) {
      cardList.splice(0, 0, (
        <Card className="mt-4" style={CardStyle} bg="dark" text="white" key="new">
          <Card.Body>
            <Button onClick={props.handleCreate}>New adventure</Button>
          </Card.Body>
        </Card>
      ));
    }

    return cardList;
  }, [props]);

  return (
    <CardDeck>
      {cards}
    </CardDeck>
  );
}

interface IAdventureCardsProps {
  showNewAdventureCard: boolean;
  handleCreate: () => void;
  adventures: IAdventureSummary[];
}

function AdventureCards(props: IAdventureCardsProps) {
  const [width, setWidth] = useState<number | undefined>(undefined);
  const cards = useMemo(
    () => width === undefined || width <= 400 ? (
      <AdventureCardsCollapsing {...props} />
    ) : (
      <AdventureCardsLarge {...props} />
    ), [props, width]
  );

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

export default AdventureCards;
