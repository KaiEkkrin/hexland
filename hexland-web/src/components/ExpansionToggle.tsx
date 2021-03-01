import { useContext, useMemo } from 'react';
import * as React from 'react';

import AccordionContext from 'react-bootstrap/AccordionContext';
import { useAccordionToggle } from 'react-bootstrap/AccordionToggle';
import Card from 'react-bootstrap/Card';

import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IExpansionToggleProps {
  children: React.ReactNode;
  direction: "up" | "down";
  eventKey: string;
  callback?: any;
  rhs?: React.ReactNode | undefined;
}

// https://react-bootstrap.github.io/components/accordion/ provided the template for this stuff
function ExpansionToggle({ children, direction, eventKey, callback, rhs }: IExpansionToggleProps) {
  const currentEventKey = useContext(AccordionContext);
  const decoratedOnClick = useAccordionToggle(
    eventKey,
    () => callback?.(eventKey)
  );

  const icon = useMemo(
    () => currentEventKey === eventKey ?
      (direction === "up" ? faChevronDown : faChevronUp) :
      (direction === "up" ? faChevronUp : faChevronDown),
    [currentEventKey, direction, eventKey]
  );

  return (
    <Card.Header style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      onClick={decoratedOnClick}>
      {children}
      <div style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
        {rhs}
        <FontAwesomeIcon icon={icon} color="white" className="ml-2" />
      </div>
    </Card.Header>
  );
}

export default ExpansionToggle;