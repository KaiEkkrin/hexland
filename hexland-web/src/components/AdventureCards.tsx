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
import ImageCardContent from './ImageCardContent';

export const CardStyle: React.CSSProperties = {
  minWidth: '16rem', maxWidth: '24rem'
};

interface IAdventureCardProps {
  adventure: IAdventureSummary;
  collapsing: boolean;
}

function AdventureCard(props: IAdventureCardProps) {
  const content = useMemo(
    () => (
      <React.Fragment>
        <Card.Subtitle>By {props.adventure.ownerName}</Card.Subtitle>
        <Card.Text>{props.adventure.description}</Card.Text>
        <LinkContainer to={"/adventure/" + props.adventure.id}>
          <Card.Link>Open adventure</Card.Link>
        </LinkContainer>
      </React.Fragment>
    ),
    [props.adventure]
  );

  if (props.collapsing) {
    // TODO #108 I don't know how to include an image in a collapsing card for now
    return (
      <Card bg="dark" text="white">
        <ExpansionToggle direction="down" eventKey={props.adventure.id}>{props.adventure.name}</ExpansionToggle>
        <Accordion.Collapse eventKey={props.adventure.id}>
          <Card.Body>
            {content}
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    );
  } else {
    return (
      <Card className="mt-4" style={CardStyle} bg="dark" text="white">
        <ImageCardContent altName={props.adventure.name} imagePath={props.adventure.imagePath}>
          <Card.Title className="h5">{props.adventure.name}</Card.Title>
          {content}
        </ImageCardContent>
      </Card>
    );
  }
}

function AdventureCardsCollapsing(props: IAdventureCardsProps) {
  const cards = useMemo(() => {
    const cardList = [...props.adventures.map(v => (
      <AdventureCard key={v.id} adventure={v} collapsing={true} />
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
      <AdventureCard key={v.id} adventure={v} collapsing={false} />
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
