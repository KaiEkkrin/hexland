import { useContext, useMemo } from 'react';
import * as React from 'react';

import { useAccordionButton } from 'react-bootstrap/AccordionButton';
import AccordionContext from 'react-bootstrap/AccordionContext';
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
  const { activeEventKey } = useContext(AccordionContext);
  const decoratedOnClick = useAccordionButton(
    eventKey,
    () => callback?.(eventKey)
  );

  const icon = useMemo(
    () => activeEventKey === eventKey ?
      (direction === "up" ? faChevronDown : faChevronUp) :
      (direction === "up" ? faChevronUp : faChevronDown),
    [activeEventKey, direction, eventKey]
  );

  return (
    <Card.Header style={{ display: "flex", flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}
      onClick={decoratedOnClick}>
      {children}
      <div style={{ flexWrap: "nowrap", justifyContent: "flex-end" }}>
        {rhs}
        <FontAwesomeIcon icon={icon} color="white" className="ms-2" />
      </div>
    </Card.Header>
  );
}

export default ExpansionToggle;