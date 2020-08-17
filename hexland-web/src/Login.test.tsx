import React from 'react';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SimulatedSingleComponent } from './App.test';
import Login from './Login';
import { act } from 'react-dom/test-utils';

describe('test login with simulated database', () => {
  var emul: firebase.app.App[] = [];

  afterEach(async () => {
    await emul.pop()?.delete();
  });

  test('login with Google fails', async () => {
    const { findByText, getByRole, queryByText } = render(
      <SimulatedSingleComponent location="/login" user={null} startLoggedIn={false} setApp={a => emul.push(a)}>
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

    failedElement = await findByText(/Login failed/i);
    expect(failedElement).toBeInTheDocument();
  }, 1000);

  test('login with Google succeeds', async () => {
    const { findByText, getByRole, queryByText } = render(
      <SimulatedSingleComponent location="/login" user={undefined} startLoggedIn={false} setApp={a => emul.push(a)}>
        <Login />
      </SimulatedSingleComponent>
    );

    // It should not be showing our username ("Owner")
    var userElement = queryByText(/Owner/);
    expect(userElement).toBeNull();

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    await act(async () => { userEvent.click(buttonElement); });

    userElement = await findByText(/Owner/);
    expect(userElement).toBeInTheDocument();

    // TODO Check that the redirect fires...
  }, 1000);
});