import React, { useCallback, useContext, useMemo } from 'react';

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
  const isHidden = useMemo(() => analyticsContext.enabled !== undefined, [analyticsContext.enabled]);
  const handleAcceptClick = useCallback((e: React.MouseEvent) => {
    analyticsContext.setEnabled(true);
    e.preventDefault();
  }, [analyticsContext]);

  const handleDeclineClick = useCallback((e: React.MouseEvent) => {
    analyticsContext.setEnabled(false);
    e.preventDefault();
  }, [analyticsContext]);

  const rhsButtons = useMemo(() => (
    <ButtonGroup className="ml-1 mr-1">
      <Button size="sm" variant="success" onClick={handleAcceptClick}>Accept</Button>
      <Button size="sm" variant="light">More info</Button>
    </ButtonGroup>
  ), [handleAcceptClick]);

  return (
    <Accordion className="App-consent-container" defaultActiveKey="-1" hidden={isHidden}>
      <Card className="App-consent-card">
        <ExpansionToggle direction="up" eventKey="0" rhs={rhsButtons}>
          <div>
            <FontAwesomeIcon className="mr-1" icon={faCookie} color="white" />
            Wall &amp; Shadow wishes to use Google Analytics to help improve.
          </div>
        </ExpansionToggle>
        <Accordion.Collapse eventKey="0">
          <Card.Body className="App-consent-card-content">
            <div>
              Like many other websites, Wall &amp; Shadow includes Google Analytics to measure how it is used and identify errors.
              To accept this, click the Accept button. No data will be collected unless you do so. <a target="_blank" rel="noopener noreferrer" href="https://policies.google.com/technologies/partner-sites">Learn more.</a>
            </div>
            <Button className="ml-2" size="sm" variant="danger" onClick={handleDeclineClick}>Decline</Button>
          </Card.Body>
        </Accordion.Collapse>
      </Card>
    </Accordion>
  );
}

export default Consent;