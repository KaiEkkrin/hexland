import React from 'react';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SimulatedSingleComponent } from './App.test';
import Login from './Login';

describe('test login with simulated database', () => {
  var theApp: firebase.app.App[] = [];

  afterEach(() => {
    var toDelete = theApp.pop();
    toDelete?.delete()
      .catch(e => console.error("Failed to clean up app: ", e));
  });

  test('login with Google', () => {
    const { getByRole } = render(
      <SimulatedSingleComponent location="/login" user={undefined} setApp={a => theApp.push(a)}>
        <Login />
      </SimulatedSingleComponent>
    );

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    userEvent.click(buttonElement);
  });
});