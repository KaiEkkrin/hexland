import * as path from 'path';

import { Page, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

import { SCREENSHOTS_PATH } from './globals';

// Various utility functions for testing.

// Helper to extract device name from project name (e.g., "chromium-iphone7" -> "iPhone 7")
export function getDeviceNameFromProject(projectName: string): string {
  if (projectName.includes('iphone7')) return 'iPhone 7';
  if (projectName.includes('pixel2')) return 'Pixel 2';
  if (projectName.includes('laptop')) return 'Laptop';
  if (projectName.includes('desktop')) return 'Desktop';
  return 'Desktop'; // default
}

// Helper to extract browser name from project name (e.g., "chromium-laptop" -> "chromium")
export function getBrowserNameFromProject(projectName: string): string {
  if (projectName.startsWith('chromium')) return 'chromium';
  if (projectName.startsWith('firefox')) return 'firefox';
  if (projectName.startsWith('webkit')) return 'webkit';
  return 'chromium'; // default
}

export function takeScreenshot(page: Page, browserName: string, deviceName: string, message: string) {
  return page.screenshot({
    path: path.join(
      SCREENSHOTS_PATH, `${browserName}_${deviceName}_${message}.png`
    )
  });
}

export async function takeAndVerifyScreenshot(page: Page, browserName: string, deviceName: string, message: string) {
  // Wait a bit to give animations some time to complete
  // (I don't see a nice way to do this better)
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Use Playwright's native screenshot comparison
  await expect(page).toHaveScreenshot(`${browserName}_${deviceName}_${message}.png`, {
    maxDiffPixelRatio: 0.05, // 5% threshold (matching failureThreshold from old setup)
  });
}

export function isPhone(deviceName: string) {
  return /(iPhone)|(Pixel)/.test(deviceName);
}

export async function ensureNavbarExpanded(page: Page, deviceName: string) {
  // On phones we'll get the collapsed hamburger thingy
  if (isPhone(deviceName)) {
    await expect(page.locator('.navbar-toggler')).toBeVisible();
    await page.click('.navbar-toggler');
  }
}

export async function whileNavbarExpanded(page: Page, deviceName: string, fn: () => Promise<void>) {
  // Likewise
  if (isPhone(deviceName)) {
    await expect(page.locator('.navbar-toggler')).toBeVisible();
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
  await expect(page.locator('.App-login-text').first()).toBeVisible();
  await page.click('.App-header .btn-primary');
  await page.click('[id=signIn-tab-existing]');

  // Fill in the form
  await page.fill('[id=emailInput]', user.email);
  await page.fill('[id=passwordInput]', user.password);
  await page.click('button >> text=/^Sign in$/'); // regexp to avoid matching the "Sign in with..." buttons below the modal on the login page

  // Wait for the front page to come back
  await expect(page.locator('.Introduction-image')).toBeVisible();
}

export async function signUp(page: Page, deviceName: string, prefix?: string | undefined): Promise<User> {
  await ensureNavbarExpanded(page, deviceName);

  // Go through the login page
  await page.click('text="Sign up/Login"');
  await expect(page.locator('.App-login-text').first()).toBeVisible();
  await page.click('.App-header .btn-primary');
  await expect(page.locator('.modal .tab-pane').first()).toBeVisible();

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
  await expect(page.locator('.Introduction-image')).toBeVisible();

  // A verification email should have been sent (click the toast off)
  await expect(page.locator(`text="A verification email has been sent to ${user.email}"`)).toBeVisible();
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
  page: Page, browserName: string, deviceName: string,
  adventureName: string, adventureDescription: string, mapName: string, message: string
) {
  // TODO On Firefox, I get "error creating WebGL context"; on Webkit, I get
  // "no ANGLE_instanced_arrays"
  if (browserName !== 'firefox' && browserName !== 'webkit') {
    // TODO On Safari, no error but no grid shows (investigate?)
    await expect(page.locator('.Map-content')).toBeVisible();
    await whileNavbarExpanded(page, deviceName, async () => {
      await expect(page.locator(`[aria-label="Link to this adventure"] >> text="${adventureName}"`)).toBeVisible();
      await expect(page.locator(`[aria-label="Link to this map"] >> text="${mapName}"`)).toBeVisible();
    });

    // Make sure the map looks right
    await takeAndVerifyScreenshot(page, browserName, deviceName, message);

    // Return to the adventure page, waiting for the description to pop up again
    await whileNavbarExpanded(page, deviceName, async () => {
      await page.click(`[aria-label="Link to this adventure"] >> text="${adventureName}"`);
    });
    await expect(page.locator(`.card-text >> text="${adventureDescription}"`)).toBeVisible();
  } else {
    // Click off the error.  I can continue, but need to navigate back to the adventure
    await page.click('.toast-header .close');
    await page.click('text="Open adventure"');
  }
}
