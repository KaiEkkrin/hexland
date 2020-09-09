import React, { useContext, useMemo } from 'react';

import AccordionContext from 'react-bootstrap/AccordionContext';
import { useAccordionToggle } from 'react-bootstrap/AccordionToggle';
import Card from 'react-bootstrap/Card';

import { faChevronUp, faChevronDown } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

interface IExpansionToggleProps {
  children: React.ReactNode;
  eventKey: string;
  callback?: any;
}

// https://react-bootstrap.github.io/components/accordion/ provided the template for this stuff
function ExpansionToggle(props: IExpansionToggleProps) {
  const currentEventKey = useContext(AccordionContext);
  const decoratedOnClick = useAccordionToggle(
    props.eventKey,
    () => props.callback?.(props.eventKey)
  );

  const icon = useMemo(
    () => currentEventKey === props.eventKey ? faChevronUp : faChevronDown,
    [currentEventKey, props.eventKey]
  );

  return (
    <Card.Header style={{ display: "flex", flexDirection: "row", justifyContent: "space-between" }}
      onClick={decoratedOnClick}>
      {props.children}
      <FontAwesomeIcon icon={icon} color="white" className="ml-2" />
    </Card.Header>
  );
}

export default ExpansionToggle;