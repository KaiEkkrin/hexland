import * as path from 'path';

import { Page, expect } from '@playwright/test';
import { v7 as uuidv7 } from 'uuid';

import { SCREENSHOTS_PATH } from './globals';

// Various utility functions for testing.

/**
 * Accepts the cookie consent banner by clicking the Accept button and waiting for it to disappear.
 * Uses precise mouse positioning to avoid clicks being intercepted by the Firebase emulator warning.
 */
export async function acceptCookieConsent(page: Page) {
  // Click on the top-left of the Accept button to avoid the Firebase emulator warning banner
  const acceptButton = page.locator('.App-consent-card .btn-success');
  const buttonBox = await acceptButton.boundingBox();
  if (buttonBox) {
    // Click 10px from left, 8px from top (top half of button)
    await page.mouse.click(buttonBox.x + 10, buttonBox.y + 8);
  } else {
    throw new Error('Accept button not found');
  }

  // Wait for consent banner to hide after accepting (localStorage must save before we navigate)
  await expect(page.locator('.App-consent-container')).not.toBeVisible({ timeout: 3000 });
}

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
    email: `${prefix ?? "Test"}${n}-${uuidv7()}@example.com`.toLowerCase(),
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
  await page.click('.toast-header .btn-close');
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

  // Wait for navigation to complete after clicking Save
  // React Router uses history.replace() which is client-side navigation
  await Promise.all([
    page.waitForURL('**/map/**', { timeout: 10000 }), // Wait for URL to change to map page
    page.click('text="Save map"'),
  ]);

  console.log('✓ Navigation to map page completed, URL:', page.url());
}

export async function verifyMap(
  page: Page, browserName: string, deviceName: string,
  adventureName: string, adventureDescription: string, mapName: string, message: string
) {
  // TODO On Webkit, I get "no ANGLE_instanced_arrays"
  if (browserName !== 'webkit') {
    // TODO On Safari, no error but no grid shows (investigate?)
    await expect(page.locator('.Map-content')).toBeVisible();

    // Wait for the loading spinner to disappear - this indicates stateMachine is initialized
    // The breadcrumb won't appear until map/mapState/profile are all loaded
    await expect(page.locator('.Throbber-container')).not.toBeVisible({ timeout: 20000 });
    console.log('✓ Throbber disappeared');

    // Wait a bit more for network activity to fully settle
    await page.waitForLoadState('networkidle', { timeout: 10000 });
    console.log('✓ Network idle');

    await whileNavbarExpanded(page, deviceName, async () => {
      // Debug: Check what's in the navbar after loading
      const navbarText = await page.locator('.navbar').textContent();
      console.log('Navbar after loading:', navbarText);

      // Check if the adventure name appears ANYWHERE on the page
      const adventureOnPage = await page.locator(`text="${adventureName}"`).count();
      console.log(`"${adventureName}" appears ${adventureOnPage} times on page`);

      // Check all elements with aria-labels in the navbar
      const ariaLabelElements = await page.locator('.navbar [aria-label]').all();
      console.log(`Found ${ariaLabelElements.length} elements with aria-label in navbar`);
      for (const el of ariaLabelElements) {
        const label = await el.getAttribute('aria-label');
        const text = await el.textContent();
        console.log(`  - aria-label="${label}": "${text}"`);
      }

      // Check the entire page for elements with our aria-labels
      const adventureLinkAll = await page.locator('[aria-label="Link to this adventure"]').all();
      console.log(`Found ${adventureLinkAll.length} elements with aria-label="Link to this adventure" on entire page`);

      // Breadcrumb links appear after map/mapState/profile all load
      const adventureLink = page.locator('[aria-label="Link to this adventure"]');
      await expect(adventureLink).toBeVisible({ timeout: 10000 });
      await expect(adventureLink).toContainText(adventureName);

      const mapLink = page.locator('[aria-label="Link to this map"]');
      await expect(mapLink).toBeVisible({ timeout: 10000 });
      await expect(mapLink).toContainText(mapName);
    });

    // Small delay for rendering stability before screenshot
    await page.waitForTimeout(500);

    // Make sure the map looks right
    await takeAndVerifyScreenshot(page, browserName, deviceName, message);

    // Return to the adventure page, waiting for the description to pop up again
    await whileNavbarExpanded(page, deviceName, async () => {
      await page.locator('[aria-label="Link to this adventure"]').filter({ hasText: adventureName }).click();
    });
    await expect(page.locator('.card-text').filter({ hasText: adventureDescription })).toBeVisible();
  } else {
    // Click off the error.  I can continue, but need to navigate back to the adventure
    await page.click('.toast-header .btn-close');
    await page.click('text="Open adventure"');
  }
}
