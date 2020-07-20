import React from 'react';
import logo from './logo.svg';
import './App.css';
import Navigation from './Navigation';

import Button from 'react-bootstrap/Button';

function Home() {
  return (
    <div>
      <Navigation />
      <header className="App-header">
        <Button>A Bootstrap button</Button>
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default Home;
