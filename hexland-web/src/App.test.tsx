import React from 'react';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

import App from './App';
import { IUser } from './services/interfaces';

import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { act } from 'react-dom/test-utils';

import { v4 as uuidv4 } from 'uuid';

// Most of this testing has moved into e2e.  I'm keeping a little bit here because,
// for example, it looks like Playwright doesn't have a great interface to local storage
// and I'd like something more white-box to verify the GA setting.

// TODO This plugs in things like the simulated auth, which I'm still using.  It would be nice
// to get rid of it someday.
jest.mock('./components/FirebaseContextProvider');
jest.mock('./components/Routing');

// We mock `useHistory` providing this way to wait for changes:

interface IHistoryChange {
  verb: string; // 'goBack', 'replace', 'push'
  parameter?: string | undefined;
}

const historySubject = new Subject<IHistoryChange>();
const mockHistory = {
  goBack: jest.fn(() => historySubject.next({ verb: 'goBack' })),
  replace: jest.fn(l => historySubject.next({ verb: 'replace', parameter: l })),
  push: jest.fn(l => historySubject.next({ verb: 'push', parameter: l }))
};

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => mockHistory,
}));

// These helpers let us mock up the local storage and track analysis context changes:
interface IStorageChange {
  key: string;
  value: string | null;
}

const mockStorageSubject = new Subject<IStorageChange>();
const mockStorage: { [key: string]: string } = {};

const mockGetItem = jest.fn((key: string) => mockStorage[key] ?? null);
const mockSetItem = jest.fn((key: string, value: string | null) => {
  if (value === null) {
    delete mockStorage[key];
    mockStorageSubject.next({ key: key, value: null });
  } else {
    mockStorage[key] = value;
    mockStorageSubject.next({ key: key, value: value });
  }
});

// Creates a unique user and returns its record.
// Note that we should *always* use this, because we have to test with a default
// project ID (due to Firebase Functions emulator limitation), and therefore
// the results of previous tests might be in the database (as different users.)
// Do not test with the default "owner" user.
function createTestUser(displayName: string, email: string, providerId: string, emailVerified?: boolean | undefined): IUser {
  const uid = uuidv4();
  return {
    displayName: displayName,
    email: email,
    emailMd5: "",
    emailVerified: emailVerified ?? true,
    providerId: providerId,
    uid: uid,
    changePassword: jest.fn(),
    sendEmailVerification: jest.fn(),
    updateProfile: jest.fn()
  };
}

describe('test app', () => {
  // This helper function verifies it can log in with Google and returns the redirect.
  async function logInWithGoogle(user: IUser): Promise<IHistoryChange | undefined> {
    const { findByText, getByRole, queryByText } = render(
      <App user={user} defaultRoute="/login" />
    );

    // It should not be showing our username
    let userElement = queryByText(user.displayName);
    expect(userElement).toBeNull();

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    const historyChange: IHistoryChange[] = [];
    await act(async () => {
      const historyWillChange = historySubject.pipe(first()).toPromise();
      userEvent.click(buttonElement);
      historyChange.push(await historyWillChange);
    });

    userElement = await findByText(user.displayName);
    expect(userElement).toBeInTheDocument();

    cleanup();
    return historyChange[0];
  }

  // *** TESTS *** 

  test('login with Google fails', async () => {
    const { findByText, getByRole, queryByText } = render(
      <App user={null} defaultRoute="/login" />
    );

    // It should not start out showing "login failed"
    let failedElement = queryByText(/Login failed/i);
    expect(failedElement).toBeNull();

    // Find the login button and click it
    const buttonElement = getByRole('button', { name: /Sign in with Google/i });
    expect(buttonElement).toBeInTheDocument();

    await act(async () => userEvent.click(buttonElement));

    failedElement = await findByText(/Login failed/i);
    expect(failedElement).toBeInTheDocument();
  });

  test('log in and twiddle the analytics setting', async () => {
    // Get logged in
    const user = createTestUser('A User', 'user@example.com', 'google.com');
    let redirectToHome = await logInWithGoogle(user);
    expect(redirectToHome?.verb).toBe('replace');
    expect(redirectToHome?.parameter).toBe('/');

    // Load the home page.  We expect analytics to be disabled and the GA acceptance
    // thingummy to be there.
    const { findByLabelText, findByRole, getByRole, queryByRole } = render(
      <App user={user} getItem={mockGetItem} setItem={mockSetItem} defaultRoute="/" />
    );

    let acceptElement = await findByRole('button', { name: /Accept/i });
    expect(acceptElement).toBeInTheDocument();

    const ownerElement = await findByRole('button', { name: /^A User/ });
    expect(ownerElement).toBeInTheDocument();

    // Click that accept button
    await act(async () => {
      const waitForEnabled = mockStorageSubject.pipe(first()).toPromise();
      userEvent.click(acceptElement);
      await waitForEnabled;
    });

    // That should set the analytics enabled flag...
    expect(mockStorage["analyticsEnabled"]).toBe("true");

    // That analytics check box should be popping up too
    await act(async () => userEvent.click(ownerElement));
    const checkboxElement = await findByLabelText(/Allow Google Analytics/i);
    expect(checkboxElement).toBeInTheDocument();
    expect(checkboxElement).toBeChecked();

    const saveElement = getByRole('button', { name: /Save profile/i });
    expect(saveElement).toBeInTheDocument();

    // And that analytics toast should be gone
    acceptElement = queryByRole('button', { name: /Accept/i });
    expect(acceptElement).toBeNull();

    // Un-check the box and save and we should find that analytics is disabled again
    const waitForDisabled = mockStorageSubject.pipe(first()).toPromise();
    await act(async () => userEvent.click(checkboxElement)); // this must be in a separate `act()` or it hasn't propagated before the `handleSaveProfile` is called!
    await act(async () => {
      userEvent.click(saveElement);
      await waitForDisabled;
    });

    // The analytics enabled flag should now be off again
    expect(mockStorage["analyticsEnabled"]).toBe("false");
  }, 10000);
});