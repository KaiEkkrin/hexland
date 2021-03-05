import * as path from 'path';

import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

import { SCREENSHOTS_PATH } from './globals';
import { TestState } from './types';

// Various utility functions for testing.

export function takeScreenshot(state: TestState, message: string) {
  return state.page.screenshot({
    path: path.join(
      SCREENSHOTS_PATH, `${state.browserName}_${state.deviceName}_${message}.png`
    )
  });
}

export async function takeAndVerifyScreenshot(state: TestState, message: string) {
  // Wait a bit to give animations some time to complete
  // (I don't see a nice way to do this better)
  await new Promise((resolve) => setTimeout(resolve, 500));

  const ss = await takeScreenshot(state, message);
  expect(ss).toMatchImageSnapshot({
    comparisonMethod: 'ssim',
    failureThreshold: 0.05,
    failureThresholdType: "percent",
    customSnapshotIdentifier: ({ defaultIdentifier }) => `${defaultIdentifier}-${message}`
  });
}

export function isPhone(deviceName: string) {
  return /(iPhone)|(Pixel)/.test(deviceName);
}

export async function ensureNavbarExpanded(deviceName: string, page: Page) {
  // On phones we'll get the collapsed hamburger thingy
  if (isPhone(deviceName)) {
    await expect(page).toHaveSelector('.navbar-toggler');
    await page.click('.navbar-toggler');
  }
}

export async function whileNavbarExpanded(deviceName: string, page: Page, fn: () => Promise<void>) {
  // Likewise
  if (isPhone(deviceName)) {
    await expect(page).toHaveSelector('.navbar-toggler');
    await page.click('.navbar-toggler');
    await fn();
    await page.click('.navbar-toggler'); // collapse it back down again
  } else {
    await fn();
  }
}

export type User = { displayName: string, email: string, number: number, password: string };
let signupNumber = 0;

export async function signIn(page: Page, user: User) {
  // Go through the login page
  await page.click('text="Sign up/Login"');
  await expect(page).toHaveSelector('.App-login-text');
  await page.click('.App-header .btn-primary');
  await page.click('[id=signIn-tab-existing]');

  // Fill in the form
  await page.fill('[id=emailInput]', user.email);
  await page.fill('[id=passwordInput]', user.password);
  await page.click('button >> text=/^Sign in$/'); // regexp to avoid matching the "Sign in with..." buttons below the modal on the login page

  // Wait for the front page to come back
  await expect(page).toHaveSelector('.Introduction-image');
}

export async function signUp(deviceName: string, page: Page, prefix?: string | undefined): Promise<User> {
  await ensureNavbarExpanded(deviceName, page);

  // Go through the login page
  await page.click('text="Sign up/Login"');
  await expect(page).toHaveSelector('.App-login-text');
  await page.click('.App-header .btn-primary');
  await expect(page).toHaveSelector('.modal .tab-pane');

  // Fill in the form.  Take care to create unique email addresses because
  // we may be re-using the authentication emulator instance from another run
  const n = ++signupNumber;
  const user = {
    displayName: `${prefix ?? "Test"} ${n}`,
    email: `${prefix ?? "Test"}${n}-${uuidv4()}@example.com`.toLowerCase(),
    number: n,
    password: `${prefix ?? "Test"}_password${n}`
  };
  await page.fill('[id=nameInput]', user.displayName);
  await page.fill('[id=newEmailInput]', user.email);
  await page.fill('[id=newPasswordInput]', user.password);
  await page.fill('[id=confirmPasswordInput]', user.password);

  // Sign up
  await page.click('button >> text="Sign up"');

  // Wait for the front page to come back
  await expect(page).toHaveSelector('.Introduction-image');

  // A verification email should have been sent (click the toast off)
  await expect(page).toHaveSelector(`text="A verification email has been sent to ${user.email}"`);
  await page.click('.toast-header .close');
  return user;
}

export async function createNewAdventure(page: Page, name: string, description: string) {
  await page.click('text="New adventure"');

  await page.fill('[id=adventureNameInput]', name);
  await page.fill('[id=adventureDescriptionInput]', description);
  await page.click('text="Save adventure"');
}

export async function createNewMap(
  page: Page,
  name: string, description: string, type: string, adventureId?: string | undefined, ffa?: boolean | undefined
) {
  // This tends to disappear off the bottom on phones
  const newMap = await page.waitForSelector('text="New map"');
  await newMap.scrollIntoViewIfNeeded();
  await newMap.click();

  await page.fill('[id=mapNameInput]', name);
  await page.fill('[id=mapDescriptionInput]', description);
  await page.selectOption('select#mapType', type);
  if (adventureId !== undefined) {
    await page.selectOption('select#mapAdventureSelect', { value: adventureId });
  }

  if (ffa === true) {
    await page.check('[id=mapFfa]');
  }

  await page.click('text="Save map"');
}

export async function verifyMap(
  browserName: string, deviceName: string, page: Page, state: TestState,
  adventureName: string, adventureDescription: string, mapName: string, message: string
) {
  // TODO On Firefox, I get "error creating WebGL context"; on Webkit, I get
  // "no ANGLE_instanced_arrays"
  if (browserName !== 'firefox' && browserName !== 'webkit') {
    // TODO On Safari, no error but no grid shows (investigate?)
    await expect(page).toHaveSelector('css=.Map-content');
    await whileNavbarExpanded(deviceName, page, async () => {
      await expect(page).toHaveSelector(`css=[aria-label="Link to this adventure"] >> text="${adventureName}"`);
      await expect(page).toHaveSelector(`css=[aria-label="Link to this map"] >> text="${mapName}"`);
    });

    // Make sure the map looks right
    await takeAndVerifyScreenshot(state, message);

    // Return to the adventure page, waiting for the description to pop up again
    await whileNavbarExpanded(deviceName, page, async () => {
      await page.click(`css=[aria-label="Link to this adventure"] >> text="${adventureName}"`);
    });
    await expect(page).toHaveSelector(`css=.card-text >> text="${adventureDescription}"`);
  } else {
    // Click off the error.  I can continue, but need to navigate back to the adventure
    await page.click('.toast-header .close');
    await page.click('text="Open adventure"');
  }
}