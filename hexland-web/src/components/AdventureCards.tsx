import { useMemo, useState } from 'react';
import * as React from 'react';
import '../App.css';

import ExpansionToggle from './ExpansionToggle';

import { IAdventureSummary } from '../data/profile';

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import CardDeck from 'react-bootstrap/CardDeck';

import { LinkContainer } from 'react-router-bootstrap';
import Measure from 'react-measure';
import ImageCardContent from './ImageCardContent';

export const CardStyle: React.CSSProperties = {
  minWidth: '16rem', maxWidth: '24rem'
};

interface IAdventureCardProps {
  adventure: IAdventureSummary;
  collapsing: boolean;
}

const AdventureCard = ({ adventure, collapsing }: IAdventureCardProps) => {
  const content = useMemo(
    () => (
      <React.Fragment>
        <Card.Subtitle>By {adventure.ownerName}</Card.Subtitle>
        <Card.Text>{adventure.description}</Card.Text>
        <LinkContainer to={"/adventure/" + adventure.id}>
          <Card.Link>Open adventure</Card.Link>
        </LinkContainer>
      </React.Fragment>
    ),
    [adventure]
  );

  if (collapsing) {
    // TODO #108 I don't know how to include an image in a collapsing card for now
    return (
      <Card bg="dark" text="white">
        <ExpansionToggle direction="down" eventKey={adventure.id}>{adventure.name}</ExpansionToggle>
        <Accordion.Collapse eventKey={adventure.id}>
          <Card.Body>
            {content}
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    );
  } else {
    return (
      <Card className="mt-4" style={CardStyle} bg="dark" text="white">
        <ImageCardContent altName={adventure.name} imagePath={adventure.imagePath}>
          <Card.Title className="h5">{adventure.name}</Card.Title>
          {content}
        </ImageCardContent>
      </Card>
    );
  }
}

interface IAdventureCardsProps {
  showNewAdventureCard: boolean;
  handleCreate: () => void;
  adventures: IAdventureSummary[];
}

const AdventureCardsCollapsing = ({ showNewAdventureCard, handleCreate, adventures }: IAdventureCardsProps) => {
  const cards = useMemo(() => {
    const cardList = [...adventures.map(v => (
      <AdventureCard key={v.id} adventure={v} collapsing={true} />
    ))];

    if (showNewAdventureCard) {
      cardList.splice(0, 0, (
        <Card bg="dark" text="white" key="new">
          <Card.Header>
            <Button onClick={handleCreate}>New adventure</Button>
          </Card.Header>
        </Card>
      ));
    }

    return cardList;
  }, [adventures, handleCreate, showNewAdventureCard]);

  return (
    <Accordion className="mt-4">
      {cards}
    </Accordion>
  );
}

const AdventureCardsLarge = ({ showNewAdventureCard, handleCreate, adventures }: IAdventureCardsProps) => {
  const cards = useMemo(() => {
    const cardList = [...adventures.map(v => (
      <AdventureCard key={v.id} adventure={v} collapsing={false} />
    ))];

    if (showNewAdventureCard) {
      cardList.splice(0, 0, (
        <Card className="mt-4" style={CardStyle} bg="dark" text="white" key="new">
          <Card.Body>
            <Button onClick={handleCreate}>New adventure</Button>
          </Card.Body>
        </Card>
      ));
    }

    return cardList;
  }, [showNewAdventureCard, handleCreate, adventures]);

  return (
    <CardDeck>
      {cards}
    </CardDeck>
  );
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
