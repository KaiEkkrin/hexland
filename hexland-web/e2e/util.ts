import { Page } from 'playwright';
import { v4 as uuidv4 } from 'uuid';

// Various utility functions for testing.

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
  await page.click('text="Sign up"', { force: true });

  // Wait for the front page to come back
  await expect(page).toHaveSelector('.App-introduction-image');

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