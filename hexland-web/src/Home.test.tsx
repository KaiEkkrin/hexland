import React from 'react';

import { SimulatedSingleComponent } from './App.test';
import HomePage from './Home';

import { render } from '@testing-library/react';

// TODO No; move this kind of multi-page thing to the app test.
// In general, I think that in all my UI tests, I want to log in first, and
// then do the thing...?
describe('test home with simulated database', () => {
  var theApp: firebase.app.App[] = [];

  afterEach(async () => {
    await theApp.pop()?.delete();
  });

  test('latest maps and latest adventures headings are there', () => {
    const { getByText } = render(
      <SimulatedSingleComponent user={undefined} startLoggedIn={true} location="/" setApp={a => theApp.push(a)}>
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