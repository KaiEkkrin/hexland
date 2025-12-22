import { useMemo, useState } from 'react';
import * as React from 'react';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';
import Nav from 'react-bootstrap/Nav';

export interface IMapInfoCardProps {
  title: string;
  buttonContent: React.ReactNode;
  children: React.ReactNode;
  bg?: string | undefined;
}

function MapInfoCard(props: IMapInfoCardProps) {
  const [isCollapsed, setIsCollapsed] = useState(true);
  const buttonVariant = useMemo(() => props.bg ?? "dark", [props.bg]);

  if (isCollapsed) {
    return (
      <Button className="Map-info-card" title={props.title} variant={buttonVariant}
        onClick={() => setIsCollapsed(false)}
      >
        {props.buttonContent}
      </Button>
    );
  }

  return (
    <Card className="Map-info-card mb-2" bg="dark" text="white">
      <Card.Header>
        <Nav className="justify-content-between">
          <Nav.Item>
            <h5>{props.title}</h5>
          </Nav.Item>
          <Nav.Item>
            <Button className="ms-2" variant={buttonVariant} onClick={() => setIsCollapsed(true)}>
              {props.buttonContent}
            </Button>
          </Nav.Item>
        </Nav>
      </Card.Header>
      {props.children}
    </Card>
  );
}

export default MapInfoCard;