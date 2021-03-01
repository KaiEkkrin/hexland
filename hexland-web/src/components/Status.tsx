import { useCallback, useEffect, useMemo, useState } from 'react';
import * as React from 'react';
import '../App.css';
import packageJson from '../../package.json';

import Button from 'react-bootstrap/Button';
import Card from 'react-bootstrap/Card';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCodeBranch, faTimes } from '@fortawesome/free-solid-svg-icons';

// A component that can go along the bottom of pages.
// I could use this for error reporting toasts, social media links,
// etc.

interface IDependencyProps {
  name: string;
}

function Dependency(props: IDependencyProps) {
  return (
    <li className="App-status-list-item">{props.name}</li>
  );
}

function Dependencies() {
  const depList = useMemo(() => {
    function *enumerateDepList() {
      for (const d in packageJson.dependencies) {
        yield (<Dependency key={d} name={d} />);
      }
    }

    return [...enumerateDepList()];
  }, []);

  return (<ul className="App-status-list">{depList}</ul>);
}

function Status() {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // #162: On narrow screens we squeeze that version button down so that it doesn't block
  // the collapse button of one of the adventure or map cards
  const [width, setWidth] = useState(window.innerWidth);
  const handleWindowResize = useCallback(() => setWidth(window.innerWidth), [setWidth]);
  useEffect(() => {
    window.addEventListener('resize', handleWindowResize);
    return () => { window.removeEventListener('resize', handleWindowResize); };
  }, [handleWindowResize]);

  const collapsedStatus = useMemo(
    () => width < 450 ? (
      <div className="App-status">
        <Button className="mb-2" style={{ marginRight: '-0.5rem' }} size="sm" variant="info"
          onClick={() => setIsCollapsed(false)}
        >
          <FontAwesomeIcon icon={faCodeBranch} color="white" />
        </Button>
      </div>
    ) : (
      <div className="App-status">
        <Button className="mr-2 mb-2" size="sm" variant="info" onClick={() => setIsCollapsed(false)}>
          about | {packageJson.version}
        </Button>
      </div>
    ), [width, setIsCollapsed]
  );

  return isCollapsed ? collapsedStatus : (
    <div className="App-status-card-container">
      <Card className="App-status-card" bg="dark" text="white">
        <Card.Header className="App-status-card-header">
          <h5>About Wall &amp; Shadow</h5>
          <Button size="sm" variant="dark" onClick={() => setIsCollapsed(true)}>
            <FontAwesomeIcon icon={faTimes} />
          </Button>
        </Card.Header>
        <Card.Body className="App-status-card-body small">
          <h5>Contact</h5>
          <p>Feedback welcomed at <a href="https://twitter.com/m00sewitter" target="_blank" rel="noopener noreferrer">Twitter</a> | <a href="mailto:contact@wallandshadow.io">Email contact@wallandshadow.io</a></p>
          <h5>License</h5>
          <p>The source code to Wall &amp; Shadow is <a href="https://github.com/KaiEkkrin/hexland">available on GitHub</a> under the terms of the <a href="http://www.apache.org/licenses/LICENSE-2.0">Apache License, version 2.0</a>.</p>
          <h5>Acknowledgments</h5>
          <p>Wall &amp; Shadow would not have been possible without the help, patience and feedback of my Saturday D&amp;D group -- thank you!</p>
          <p>This web application is also enabled by the following npm packages</p>
          <Dependencies />
          <p>and the many dependencies thereof.</p>
        </Card.Body>
        <Card.Footer className="App-status-card-footer">
          <Button size="sm" variant="info" onClick={() => setIsCollapsed(true)}>
            about | {packageJson.version}
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

export default Status;