import React from 'react';

import App from './App';

import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { act } from 'react-dom/test-utils';

import { v4 as uuidv4 } from 'uuid';

jest.mock('./components/FirebaseContextProvider');
jest.mock('./components/Routing');

// Note that to successfully run tests that use the Firebase emulator you need to have
// this running somewhere:
// `firebase emulators:start --only firestore`

describe('test app as owner', () => {

  test('login with Google fails', async () => {
    const projectId = uuidv4();
    const { findByText, getByRole, queryByText } = render(
      <App projectId={projectId} user={null} defaultRoute="/login" />
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
  });

  test('login with Google succeeds', async () => {
    const projectId = uuidv4();
    const { findByRole, findByText, getByRole, queryByText } = render(
      <App projectId={projectId} user={undefined} defaultRoute="/login" />
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

    // We should get redirected to the home page, complete with a "New adventure"
    // button:
    // TODO I don't think I can expect this to work.  Instead, I should mock
    // `useHistory`, and when it has fired, render the home page manually using
    // the same project id.  I should be able to make the mock `useHistory` resolve
    // a promise, although I might need to do the naughty thing and extract the `resolve`
    // and `reject` parameters from the Promise constructor.
    // See https://stackoverflow.com/questions/26150232/resolve-javascript-promise-outside-function-scope
    // const newAdventureElement = await findByRole('button', { name: /New adventure/i });
    // expect(newAdventureElement).toBeInTheDocument();
  });
});