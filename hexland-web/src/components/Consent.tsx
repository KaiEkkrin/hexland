import React, { useCallback, useContext } from 'react';

import { AnalyticsContext } from './AnalyticsContextProvider';
import ExpansionToggle from './ExpansionToggle';

import Accordion from 'react-bootstrap/Accordion';
import Button from 'react-bootstrap/Button';
import ButtonGroup from 'react-bootstrap/ButtonGroup';
import Card from 'react-bootstrap/Card';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCookie } from '@fortawesome/free-solid-svg-icons';

// This is the Google Analytics consent thingumajig.
// TODO #65 Attach it to an analytics context, and make a mock one and write some
// testing to verify that it doesn't enable itself unless the consent is accepted.
// When accepted, have it disappear into the user's profile settings.
function Consent() {
  const analyticsContext = useContext(AnalyticsContext);
  const handleAcceptClick = useCallback((e: React.MouseEvent) => {
    analyticsContext.setEnabled(true);
    e.preventDefault();
  }, [analyticsContext]);

  return (
    <Accordion className="App-consent-container" defaultActiveKey="-1" hidden={analyticsContext.enabled}>
      <Card className="App-consent-card">
        <ExpansionToggle direction="up" eventKey="0">
          <div>
            <FontAwesomeIcon className="mr-1" icon={faCookie} color="white" />
            Hexland wishes to use Google Analytics to help improve.
          <ButtonGroup className="ml-1 mr-1">
            <Button size="sm" variant="success" onClick={handleAcceptClick}>Accept</Button>
            <Button size="sm" variant="light">More info</Button>
          </ButtonGroup>
          </div>
        </ExpansionToggle>
        <Accordion.Collapse eventKey="0">
          <Card.Body>
            Like many other websites, Hexland can use Google Analytics to measure how it is used and identify errors.
            To accept this data collection and the cookies required, click the Accept button. <a target="_blank" rel="noopener noreferrer" href="https://policies.google.com/technologies/partner-sites">Learn more.</a>
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    </Accordion>
  );
}

export default Consent;