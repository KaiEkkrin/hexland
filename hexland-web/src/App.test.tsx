import React from 'react';
import { Subject } from 'rxjs';
import { first } from 'rxjs/operators';

import App from './App';
import { IUser } from './services/interfaces';

import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { act } from 'react-dom/test-utils';

import { v4 as uuidv4 } from 'uuid';

// Note that to successfully run tests that use the Firebase emulator you need to have
// this running somewhere:
// `cd functions && yarn serve`
jest.mock('./components/FirebaseContextProvider');
jest.mock('./components/Routing');
jest.mock('./models/three/drawing.ts');

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

// Some return types from our test helper functions.
interface IAdventureAndMapLinks {
  adventureLink: string;
  mapLink: string;
}

interface IPageCheck {
  textsPresent: RegExp[];
  textsAbsent?: RegExp[] | undefined;
}

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

  async function fillInNewAdventureModal(findByLabelText: any, findByRole: any, name: string, description: string) {
    // This should show the adventure creation modal:
    // - Write something in the input labelled "Name"
    // - Write something in the input labelled "Description"
    // - Click the "Save" button
    // - Both strings should now appear on the page, along with the "New map" button
    let modalAdventureNameElement = await findByLabelText(/Adventure name/);
    const modalAdventureDescriptionElement = await findByLabelText(/Adventure description/);
    const modalAdventureSaveElement = await findByRole('button', { name: /Save adventure/ });

    await act(async () => {
      await userEvent.type(modalAdventureNameElement, name);
      await userEvent.type(modalAdventureDescriptionElement, description);
      userEvent.click(modalAdventureSaveElement);
    });
  }

  async function fillInNewMapModal(findByLabelText: any, findByRole: any, name: string, description: string) {
    let modalMapNameElement = await findByLabelText(/Map name/);
    const modalMapDescriptionElement = await findByLabelText(/Map description/);
    const modalMapSaveElement = await findByRole('button', { name: /Save map/ });

    await act(async () => {
      await userEvent.type(modalMapNameElement, name);
      await userEvent.type(modalMapDescriptionElement, description);
      userEvent.click(modalMapSaveElement);
    });
  }

  async function createAdventureAndMapFromHome(user: IUser): Promise<IAdventureAndMapLinks> {
    const { findByLabelText, findByRole, findByText, queryByLabelText, queryByRole } = render(
      <App user={user} defaultRoute="/" />
    );

    const userElement = await findByText(user.displayName);
    expect(userElement).toBeInTheDocument();

    const newAdventureElement = await findByRole('button', { name: /New adventure/i });
    expect(newAdventureElement).toBeInTheDocument();

    // There shouldn't be "New map", though, because there's no adventure to create it in
    let newMapElement = queryByRole('button', { name: /New map/i });
    expect(newMapElement).toBeNull();

    await act(async () => userEvent.click(newAdventureElement));
    await fillInNewAdventureModal(findByLabelText, findByRole, "Test adventure", "Here be dragons");

    // This should now be showing "New map" (and also the adventure we just created)
    newMapElement = await findByRole('button', { name: /New map/i });
    expect(newMapElement).toBeInTheDocument();

    const adventureNameElement = await findByText(/Test adventure/);
    expect(adventureNameElement).toBeInTheDocument();

    const adventureDescriptionElement = await findByText(/Here be dragons/);
    expect(adventureDescriptionElement).toBeInTheDocument();

    // ...and the adventure modal should be gone
    const modalAdventureNameElement = queryByLabelText(/Adventure name/);
    expect(modalAdventureNameElement).toBeFalsy();

    await act(async () => userEvent.click(newMapElement));

    // This should show the map creation modal.  The process will be similar :)
    // TODO Test selecting a different adventure...
    await fillInNewMapModal(findByLabelText, findByRole, "Test map", "Dragon's lair");

    // We should now be able to find an "Open map" link and those elements
    const openMapElement = await findByText(/Open map/);
    expect(openMapElement).toBeInTheDocument();

    const mapNameElement = await findByText(/Test map/);
    expect(mapNameElement).toBeInTheDocument();

    const mapDescriptionElement = await findByText(/Dragon\'s lair/);
    expect(mapDescriptionElement).toBeInTheDocument();

    // ...and the map modal should be gone
    const modalMapNameElement = queryByLabelText(/Map name/);
    expect(modalMapNameElement).toBeFalsy();

    // Return the link to the adventure
    const adventureLinkElement = await findByText(/Open adventure/);
    expect(adventureLinkElement).toBeInTheDocument();

    cleanup();
    return {
      adventureLink: adventureLinkElement.pathname,
      mapLink: openMapElement.pathname
    };
  }

  async function createMapFromAdventure(user: IUser, pathname: string, adventureName: RegExp, adventureDescription: RegExp): Promise<string> {
    const { findByLabelText, findByRole, findByText, queryByLabelText } = render(
      <App user={user} defaultRoute={pathname} />
    );

    // This page should have "New map" and details of our adventure:
    const newMapElement = await findByRole('button', { name: /New map/i });
    expect(newMapElement).toBeInTheDocument();

    const adventureNameElement = await findByText(adventureName);
    expect(adventureNameElement).toBeInTheDocument();

    const adventureDescriptionElement = await findByText(adventureDescription);
    expect(adventureDescriptionElement).toBeInTheDocument();

    await act(async () => userEvent.click(newMapElement));

    // This should show the map creation modal.  The process will be similar :)
    await fillInNewMapModal(findByLabelText, findByRole, "Test map", "Dragon's lair");

    // We should now be able to find an "Open map" link and those elements
    const openMapElement = await findByText(/Open map/);
    expect(openMapElement).toBeInTheDocument();

    const mapNameElement = await findByText(/Test map/);
    expect(mapNameElement).toBeInTheDocument();

    const mapDescriptionElement = await findByText(/Dragon\'s lair/);
    expect(mapDescriptionElement).toBeInTheDocument();

    // ...and the map modal should be gone
    const modalMapNameElement = queryByLabelText(/Map name/);
    expect(modalMapNameElement).toBeFalsy();

    // Return the link to the map
    cleanup();
    return openMapElement.pathname;
  }

  async function createAdventureAndMapFromAll(user: IUser): Promise<IAdventureAndMapLinks> {
    const { findByLabelText, findByRole, findByText, queryByLabelText, queryByRole } = render(
      <App user={user} defaultRoute="/all" />
    );

    const userElement = await findByText(user.displayName);
    expect(userElement).toBeInTheDocument();

    const newAdventureElement = await findByRole('button', { name: /New adventure/i });
    expect(newAdventureElement).toBeInTheDocument();

    // There shouldn't be "New map", though -- of course, it's the All (adventures) page!
    const newMapElement = queryByRole('button', { name: /New map/i });
    expect(newMapElement).toBeNull();

    await act(async () => userEvent.click(newAdventureElement));
    await fillInNewAdventureModal(findByLabelText, findByRole, "Test adventure", "Here be dragons");

    // This should now be showing the adventure we just created
    const adventureNameElement = await findByText(/Test adventure/);
    expect(adventureNameElement).toBeInTheDocument();

    const adventureDescriptionElement = await findByText(/Here be dragons/);
    expect(adventureDescriptionElement).toBeInTheDocument();

    // ...and the adventure modal should be gone
    const modalAdventureNameElement = queryByLabelText(/Adventure name/);
    expect(modalAdventureNameElement).toBeFalsy();

    // There should be an adventure link we can click
    const openAdventureElement = await findByText(/Open adventure/);
    expect(openAdventureElement).toBeInTheDocument();

    // Navigate there to create the map
    cleanup();
    const mapLink = await createMapFromAdventure(user, openAdventureElement.pathname, /Test adventure/, /Here be dragons/);
    return {
      adventureLink: openAdventureElement.pathname,
      mapLink: mapLink
    };
  }

  async function checkPage(location: string | undefined, check: IPageCheck, user: IUser) {
    console.log("checking page " + location);
    // This function simply render a page and checks the string texts are all (eventually) found in it.
    const { findByText, queryByText } = render(
      <App user={user} defaultRoute={location ?? '/'} />
    );

    for (let text of check.textsPresent) {
      let found = await findByText(text);
      expect(found).toBeInTheDocument();
    }

    if (check.textsAbsent !== undefined) {
      for (let text of check.textsAbsent) {
        let found = queryByText(text);
        expect(found).toBeFalsy();
      }
    }

    cleanup();
  }

  function loadPageExpectingRedirect(location: string | undefined, user: IUser): Promise<IHistoryChange> {
    const historyWillChange = historySubject.pipe(first()).toPromise();
    render(
      <App user={user} defaultRoute={location ?? '/'} />
    );
    cleanup();
    return historyWillChange;
  }

  async function createInviteLink(location: string, user: IUser): Promise<string> {
    // Render the adventure page
    const { findByRole, findByText } = render(
      <App user={user} defaultRoute={location} />
    );

    // This should contain our test adventure and map descriptions
    const adventureDescriptionElement = await findByText(/Here be dragons/);
    expect(adventureDescriptionElement).toBeInTheDocument();

    const mapDescriptionElement = await findByText(/Dragon\'s lair/);
    expect(mapDescriptionElement).toBeInTheDocument();

    // Click the create invite button -- this should replace it with an anchor
    const inviteButtonElement = await findByRole('button', { name: /Create invite link/i });
    expect(inviteButtonElement).toBeInTheDocument();

    await act(async () => {
      userEvent.click(inviteButtonElement);
    });

    // The link element should now materialise
    const inviteLinkElement = await findByText(/Send this link to other players to invite them\./i);
    expect(inviteLinkElement).toBeInTheDocument();

    cleanup();
    return inviteLinkElement.pathname;
  }

  async function acceptInvite(location: string, user: IUser): Promise<IHistoryChange | undefined> {
    // render the invite page
    const { findByRole, findByText } = render(
      <App user={user} defaultRoute={location} />
    );

    // This should be showing me the invite greeting
    const greetingElement = await findByText(
      user.displayName + ", you have been invited to join",
      { exact: false }
    );
    expect(greetingElement).toBeInTheDocument();

    // and be offering me a Join button
    const joinElement = await findByRole('button', { name: /Join/ });
    expect(joinElement).toBeInTheDocument();

    // Upon click, I should be redirected to the adventure page
    const historyChange: IHistoryChange[] = [];
    await act(async () => {
      const historyWillChange = historySubject.pipe(first()).toPromise();
      userEvent.click(joinElement);
      historyChange.push(await historyWillChange);
    });

    cleanup();
    return historyChange[0];
  }

  async function checkNoTokensOnMap(location: string, user: IUser, owner: IUser): Promise<void> {
    // render the map page
    const { findByTitle, findByText, getByTitle } = render(
      <App user={user} defaultRoute={location} />
    );

    // The "no tokens" message should appear
    const noTokensElement = await findByText(/The map owner has not assigned you any tokens/);
    expect(noTokensElement).toBeInTheDocument();

    // TODO find the no players button, click it, and check it expands with
    // the two users' display names and the "no tokens" badge.
    const playersButton = getByTitle(/Players/i);
    expect(playersButton).toBeInTheDocument();

    await act(async () => {
      userEvent.click(playersButton);
    });

    // The player list should have an entry for the owner, and one for this user.
    const playersOwnerElement = await findByTitle("Player " + owner.displayName);
    expect(playersOwnerElement).toBeInTheDocument();

    const playersUserElement = await findByTitle("Player " + user.displayName);
    expect(playersUserElement).toBeInTheDocument();

    // We should also be showing suitable badges
    const playerOwnerIsOwnerElement = await findByTitle("Player " + owner.displayName + " is the owner");
    expect(playerOwnerIsOwnerElement).toBeInTheDocument();

    const playerUserHasNoTokenElement = await findByTitle("Player " + user.displayName + " has no token");
    expect(playerUserHasNoTokenElement).toBeInTheDocument();

    cleanup();
  }

  async function shareAdventureAndMap(links: IAdventureAndMapLinks, user: IUser) {
    // Open the adventure; we should see the map listed, along with "Create invite link"
    const inviteLink = await createInviteLink(links.adventureLink, user);
    console.log("Invite link: " + inviteLink);

    // Trying to load that link when not logged in (which is what our simulated auth does
    // if we change users) should get us redirected to the login page
    const user1 = createTestUser('User One', 'user1@example.com', 'google.com');
    const redirectToLogin = await loadPageExpectingRedirect(inviteLink, user1);
    expect(redirectToLogin.verb).toBe('push');
    expect(redirectToLogin.parameter).toBe('/login');

    // Get user1 logged in
    const redirectToHome = await logInWithGoogle(user1);
    expect(redirectToHome?.verb).toBe('replace');
    expect(redirectToHome?.parameter).toBe('/');

    // Accept the invite
    let redirectToAdventure = await acceptInvite(inviteLink, user1);
    expect(redirectToAdventure?.verb).toBe('replace');
    expect(redirectToAdventure?.parameter).toBe(links.adventureLink);

    // The user should see the map and adventure on the adventure page;
    // they should not be able to create a new map here
    // TODO Really I should be reading the map link from here instead!
    const checks = {
      textsPresent: [/Here be dragons/, /Dragon\'s lair/],
      textsAbsent: [/New map/]
    };
    await checkPage(redirectToAdventure?.parameter, checks, user1);

    // ...and the adventure on the shared and home pages
    await checkPage('/shared', { textsPresent: [/Here be dragons/] }, user1);
    await checkPage('/', { textsPresent: [/Test adventure/] }, user1);

    // Check the map page.  It should tell us we have no tokens
    await checkNoTokensOnMap(links.mapLink, user1, user);
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

  test('log in and edit profile', async () => {
    // Get logged in
    const user = createTestUser('A User', 'user@example.com', 'google.com');
    let redirectToHome = await logInWithGoogle(user);
    expect(redirectToHome?.verb).toBe('replace');
    expect(redirectToHome?.parameter).toBe('/');

    // If I load the home page now, it should have my display name on it
    const { findByLabelText, findByRole, getByRole, queryByRole } = render(
      <App user={user} defaultRoute="/" />
    );

    let profileButton = await findByRole('button', { name: /A User/ });
    expect(profileButton).toBeInTheDocument();

    await act(async () => userEvent.click(profileButton));

    const editNameElement = await findByLabelText(/Display name/i);
    expect(editNameElement).toBeInTheDocument();

    let saveProfileElement = getByRole('button', { name: /Save profile/i });
    expect(saveProfileElement).toBeInTheDocument();

    await act(async () => {
      await userEvent.type(editNameElement, "Fishy McFishFace");
      userEvent.click(saveProfileElement);
    });

    // This should rewrite the username button to have the updated name
    profileButton = await findByRole('button', { name: /Fishy McFishFace/ });
    expect(profileButton).toBeInTheDocument();

    // ...and the modal should have closed
    saveProfileElement = queryByRole('button', { name: /Save profile/i });
    expect(saveProfileElement).toBeNull();
  });

  test('log in and create and share an adventure and map from the home page', async () => {
    // Get logged in
    const user = createTestUser('A User', 'user@example.com', 'google.com');
    let redirectToHome = await logInWithGoogle(user);
    expect(redirectToHome?.verb).toBe('replace');
    expect(redirectToHome?.parameter).toBe('/');

    // If I load the home page now, it should let me create a new adventure and
    // it should still be showing the profile name
    const links = await createAdventureAndMapFromHome(user);
    expect(links.adventureLink).toMatch(/^\/adventure\/.*$/);
    console.log("Adventure link: " + links.adventureLink);

    await shareAdventureAndMap(links, user);
  }, 10000);

  test('log in and create and share an adventure and map from the All page', async () => {
    // Get logged in
    const user = createTestUser('A User', 'user@example.com', 'google.com');
    let redirectToHome = await logInWithGoogle(user);
    expect(redirectToHome?.verb).toBe('replace');
    expect(redirectToHome?.parameter).toBe('/');

    // Do the adventure and map creation
    const links = await createAdventureAndMapFromAll(user);
    expect(links.adventureLink).toMatch(/^\/adventure\/.*$/);
    console.log("Adventure link: " + links.adventureLink);

    await shareAdventureAndMap(links, user);
  }, 10000);

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

    const ownerElement = await findByRole('button', { name: user.displayName });
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