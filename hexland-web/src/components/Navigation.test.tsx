import React from 'react';

import { SimulatedSingleComponent } from '../App.test';
import Navigation from './Navigation';

import { render } from '@testing-library/react';

describe('test navigation with simulated database', () => {
  var theApp: firebase.app.App[] = [];

  afterEach(() => {
    var toDelete = theApp.pop();
    toDelete?.delete()
      .catch(e => console.error("Failed to clean up app: ", e));
  });

  test('title, user display name and links appear', () => {
    const { getByText } = render(
      <SimulatedSingleComponent user={undefined} startLoggedIn={true} location="/" setApp={a => theApp.push(a)}>
        <Navigation title="test title" />
      </SimulatedSingleComponent>
    );

    const brandElement = getByText(/hexland/i);
    expect(brandElement).toBeInTheDocument();

    const homeElement = getByText(/home/i);
    expect(homeElement).toBeInTheDocument();

    const allElement = getByText(/my adventures/i);
    expect(allElement).toBeInTheDocument();

    const sharedElement = getByText(/shared with me/i);
    expect(sharedElement).toBeInTheDocument();

    const titleElement = getByText(/test title/);
    expect(titleElement).toBeInTheDocument();

    const userElement = getByText(/Owner/);
    expect(userElement).toBeInTheDocument();
  });
});