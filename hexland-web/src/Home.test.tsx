import React from 'react';

import { SimulatedSingleComponent } from './App.test';
import HomePage from './Home';

import { render } from '@testing-library/react';

describe('test home with simulated database', () => {
  var theApp: firebase.app.App[] = [];

  afterEach(() => {
    var toDelete = theApp.pop();
    toDelete?.delete()
      .catch(e => console.error("Failed to clean up app: ", e));
  });

  test('latest maps and latest adventures headings are there', () => {
    const { getByText } = render(
      <SimulatedSingleComponent user={undefined} location="/" setApp={a => theApp.push(a)}>
        <HomePage />
      </SimulatedSingleComponent>
    );

    const brandElement = getByText(/hexland/i);
    expect(brandElement).toBeInTheDocument();

    const latestMapsElement = getByText(/Latest maps/);
    expect(latestMapsElement).toBeInTheDocument();

    const latestAdventuresElement = getByText(/Latest adventures/);
    expect(latestAdventuresElement).toBeInTheDocument();
  });
});