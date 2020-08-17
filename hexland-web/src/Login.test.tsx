import React from 'react';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SimulatedSingleComponent } from './App.test';
import Login from './Login';
import { act } from 'react-dom/test-utils';

describe('test login with simulated database', () => {
  var theApp: firebase.app.App[] = [];

  afterEach(() => {
    var toDelete = theApp.pop();
    toDelete?.delete()
      .catch(e => console.error("Failed to clean up app: ", e));
  });

  test('login with Google fails', async () => {
    const { getByRole, queryByText } = render(
      <SimulatedSingleComponent location="/login" user={null} startLoggedIn={false} setApp={a => theApp.push(a)}>
        <Login />
      </SimulatedSingleComponent>
    );

    // It should not start out showing "login failed"
    var failedElement = queryByText(/Login failed/i);
    expect(failedElement).toBeNull();

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    await act(async () => userEvent.click(buttonElement));

    failedElement = queryByText(/Login failed/i);
    expect(failedElement).toBeInTheDocument();
  }, 1000);

  test('login with Google succeeds', async () => {
    const { getByRole, queryByText } = render(
      <SimulatedSingleComponent location="/login" user={undefined} startLoggedIn={false} setApp={a => theApp.push(a)}>
        <Login />
      </SimulatedSingleComponent>
    );

    // It should not be showing our username ("Owner")
    var userElement = queryByText(/Owner/);
    expect(userElement).toBeNull();

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    await act(async () => userEvent.click(buttonElement));

    // This should have created a profile for the owner and displayed it in the
    // nav bar:
    userElement = queryByText(/Owner/);
    expect(userElement).toBeInTheDocument();

    // TODO Check that the redirect fires...
  }, 1000);
});