import React, { useContext, useEffect, useMemo, useState } from 'react';
import '../App.css';

import { AnalyticsContext } from './AnalyticsContextProvider';
import ExpansionToggle from './ExpansionToggle';
import { UserContext } from './UserContextProvider';

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

interface IAdventureCardProps {
  adventure: IAdventureSummary;
  collapsing: boolean;
}

function AdventureCard(props: IAdventureCardProps) {
  const analyticsContext = useContext(AnalyticsContext);
  const userContext = useContext(UserContext);
  const [url, setUrl] = useState<string | undefined>(undefined);

  // Resolve the image URL, if any
  useEffect(() => {
    if (!userContext.storageService || !props.adventure?.imagePath || props.adventure.imagePath.length === 0) {
      return;
    }

    // TODO #149 I need to be able to cancel this, right now it will cause updates after
    // the component has unmounted
    const imagePath = props.adventure.imagePath;
    userContext.storageService.ref(imagePath).getDownloadURL()
      .then(u => {
        console.log(`got download URL for image ${imagePath} : ${u}`);
        setUrl(String(u));
      })
      .catch(e => analyticsContext.logError("Failed to get download URL for image " + imagePath, e));
  }, [analyticsContext, props.adventure, setUrl, userContext.storageService]);

  // I could find no working way of splitting this apart and sharing components :/
  if (props.collapsing) {
    // TODO #108 I don't know how to include an image in a collapsing card for now
    return (
      <Card bg="dark" text="white">
        <ExpansionToggle direction="down" eventKey={props.adventure.id}>{props.adventure.name}</ExpansionToggle>
        <Accordion.Collapse eventKey={props.adventure.id}>
          <Card.Body>
            <Card.Subtitle>By {props.adventure.ownerName}</Card.Subtitle>
            <Card.Text>{props.adventure.description}</Card.Text>
            <LinkContainer to={"/adventure/" + props.adventure.id}>
              <Card.Link>Open adventure</Card.Link>
            </LinkContainer>
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    );
  } else if (url !== undefined) {
    return (
      <Card className="mt-4" style={CardStyle} bg="dark" text="white">
        <Card.Img src={url} alt={props.adventure.name} />
        <Card.ImgOverlay>
          <Card.Title>{props.adventure.name}</Card.Title>
          <Card.Subtitle>By {props.adventure.ownerName}</Card.Subtitle>
          <Card.Text>{props.adventure.description}</Card.Text>
        </Card.ImgOverlay>
        <Card.Footer>
          <LinkContainer to={"/adventure/" + props.adventure.id}>
            <Card.Link>Open adventure</Card.Link>
          </LinkContainer>
        </Card.Footer>
      </Card>
    );
  } else {
    return (
      <Card className="mt-4" style={CardStyle} bg="dark" text="white">
        <Card.Body>
          <Card.Title>{props.adventure.name}</Card.Title>
          <Card.Subtitle>By {props.adventure.ownerName}</Card.Subtitle>
          <Card.Text>{props.adventure.description}</Card.Text>
        </Card.Body>
        <Card.Footer>
          <LinkContainer to={"/adventure/" + props.adventure.id}>
            <Card.Link>Open adventure</Card.Link>
          </LinkContainer>
        </Card.Footer>
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
