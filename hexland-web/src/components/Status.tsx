import React from 'react';
import '../App.css';

import Badge from 'react-bootstrap/Badge';

import packageJson from '../../package.json';

// A component that can go along the bottom of pages.
// I could use this for error reporting toasts, social media links,
// etc.

function Status() {
  return (
    <div className="App-status">
      <Badge className="mr-2 mb-2" variant="info">v{packageJson.version}</Badge>
    </div>
  );
}

export default Status;