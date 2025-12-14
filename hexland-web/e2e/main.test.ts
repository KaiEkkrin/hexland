import { test, expect } from '@playwright/test';

import * as Oob from './oob';
import * as Util from './util';

// Tests automatically run across all projects defined in playwright.config.ts
// Each test runs against all 8 browser/device combinations

test.describe('Basic tests', () => {
  test.beforeEach(async ({ page }) => {
    // Capture browser console logs
    page.on('console', msg => {
      const text = msg.text();
      if (text.includes('[Map') || text.includes('✓')) {
        console.log('Browser console:', text);
      }
    });

    // Navigate to home page and accept cookies before each test
    await page.goto('/');
    await expect(page.locator('.Introduction-image')).toBeVisible();
    await page.click('.App-consent-card .btn-success');
  });

  test('view front page', async ({ page }, testInfo) => {
    const deviceName = Util.getDeviceNameFromProject(testInfo.project.name);
    const browserName = Util.getBrowserNameFromProject(testInfo.project.name);

    await page.waitForTimeout(500);

    // For now, just take a screenshot without verification
    // We'll regenerate baselines in Phase 5
    await Util.takeScreenshot(page, browserName, deviceName, 'view-front-page');
  });

  test('create account and login', async ({ page }, testInfo) => {
    const deviceName = Util.getDeviceNameFromProject(testInfo.project.name);
    const browserName = Util.getBrowserNameFromProject(testInfo.project.name);

    // Sign up a new user
    const user = await Util.signUp(page, deviceName);

    // I should now see my new user name appear in the nav bar.
    await Util.ensureNavbarExpanded(page, deviceName);
    await expect(page.locator(`.dropdown >> text=${user.displayName}`)).toBeVisible();

    // Click the navbar dropdown
    await page.click(`.dropdown >> text=${user.displayName}`);
    await Util.takeScreenshot(page, browserName, deviceName, 'create-account-navbar-dropdown');
    await page.click('text="Edit profile"');

    // Change the display name
    expect(await page.getAttribute('[id=nameInput]', 'value')).toBe(user.displayName);
    await page.fill('[id=nameInput]', `Re-test ${user.number}`);
    await Util.takeScreenshot(page, browserName, deviceName, 'create-account-edit-profile');
    await page.click('text="Save profile"');

    // This should have edited the name in the nav bar
    await expect(page.locator(`.dropdown >> text=Re-test ${user.number}`)).toBeVisible();

    // If we log out, we should get `Sign up/Login` back:
    await page.click('text="Log out"');
    await expect(page.locator('.nav-link >> text="Sign up/Login"')).toBeVisible();

    // Check we can log back in again too :)
    await Util.signIn(page, user);
    await Util.ensureNavbarExpanded(page, deviceName);
    await expect(page.locator(`.dropdown >> text=${user.displayName}`)).toBeVisible();

    // This user should not be marked as verified (yet)
    await expect(page.locator(`[title="${user.displayName} (Not verified)"]`)).toBeVisible();

    // Verify this user
    await Oob.verifyEmail(user.email);
    await page.reload();
    await Util.ensureNavbarExpanded(page, deviceName);

    // This user should now be marked as verified
    await expect(page.locator(`.dropdown >> text=${user.displayName}`)).toBeVisible();
    await expect(page.locator(`[title="${user.displayName} (Verified)"]`)).toBeVisible();
    await Util.takeScreenshot(page, browserName, deviceName, 'create-account-verified');
  });

  test.describe('Two-context tests', () => {
    test('share adventure and map from home', async ({ browser, page }, testInfo) => {
      const deviceName = Util.getDeviceNameFromProject(testInfo.project.name);
      const browserName = Util.getBrowserNameFromProject(testInfo.project.name);

      // Create second context for second user
      const context2 = await browser.newContext();
      const page2 = await context2.newPage();

      try {
        // Set up second page
        await page2.goto('/');
        await expect(page2.locator('.Introduction-image')).toBeVisible();
        await page2.click('.App-consent-card .btn-success');

        // Sign up a new user
        const user = await Util.signUp(page, deviceName, 'User');

        await Util.createNewAdventure(page, 'Test adventure', 'Here be dragons');
        await expect(page.locator('.h5 >> text="Test adventure"')).toBeVisible();
        await expect(page.locator('.card-text >> text="Here be dragons"')).toBeVisible();
        await Util.whileNavbarExpanded(page, deviceName, async () => {
          await expect(page.locator('[aria-label="Link to this adventure"] >> text="Test adventure"')).toBeVisible();
        });

        // Create new maps of each type making sure they look right
        await Util.createNewMap(page, 'Test map', 'Dragons lair', 'hex');
        await Util.verifyMap(
          page, browserName, deviceName,
          "Test adventure", "Here be dragons", "Test map", "share-create-map"
        );

        await Util.createNewMap(page, 'Test square map', 'Seedy tavern', 'square');
        await Util.verifyMap(
          page, browserName, deviceName,
          "Test adventure", "Here be dragons", "Test square map", "share-create-square-map"
        );

        // TODO #190 Check that without being verified, we can't create the invite link

        // Verify this user
        await Oob.verifyEmail(user.email);
        await page.reload();

        // Create and copy the share link
        await page.click('text="Create invite link"');
        const inviteLinkElement = await page.waitForSelector('text="Send this link to other players to invite them."');
        const inviteLink = await inviteLinkElement.getAttribute('href');
        expect(inviteLink).not.toBeNull();
        if (inviteLink === null) {
          throw Error("Null invite link");
        }

        // Sign up a second user, who will join the adventure
        const user2 = await Util.signUp(page2, deviceName, 'User');

        // Go to the invite link and click.  There should be a suitable greeting
        await page2.goto("http://localhost:5000" + inviteLink);
        await expect(page2.locator('text=Test adventure')).toBeVisible();
        await Util.takeScreenshot(page2, browserName, deviceName, 'share-join-adventure');
        await page2.click('text="Join"');

        // This should take us back to the adventure page, which should now include
        // both usernames in the players list
        await expect(page2.locator('.card-text >> text="Here be dragons"')).toBeVisible();
        await Util.takeScreenshot(page2, browserName, deviceName, 'share-joined-adventure');
        await expect(page2.locator(`[aria-label="Player ${user.displayName}"] >> text="${user.displayName}"`)).toBeVisible();
        await expect(page2.locator(`[aria-label="Player ${user2.displayName}"] >> text="${user2.displayName}"`)).toBeVisible();

        // The adventure owner should see these same names pop up too
        // TODO webkit stops listening?!
        if (browserName === 'webkit') {
          await page.reload();
        }
        await expect(page.locator(`[aria-label="Player ${user.displayName}"] >> text="${user.displayName}"`)).toBeVisible();
        await expect(page.locator(`[aria-label="Player ${user2.displayName}"] >> text="${user2.displayName}"`)).toBeVisible();

        await Util.takeScreenshot(page2, browserName, deviceName, 'share-joined-adventure-owner');

        // Check that user 2 can open the map, but gets the "no tokens" warning toast
        // TODO Firefox and Webkit WebGL error as in Util.verifyMap
        if (browserName !== 'firefox' && browserName !== 'webkit') {
          // Expand accordion on phones
          if (Util.isPhone(deviceName)) {
            const mapAccordion = await page2.waitForSelector('text="Test map"');
            await mapAccordion.scrollIntoViewIfNeeded();
            await mapAccordion.click();
          }

          const mapLink = await page2.waitForSelector('text="Open map"');
          await mapLink.scrollIntoViewIfNeeded();
          await mapLink.click();

          // Make sure this map looks right too
          await expect(page2.locator('text=The map owner has not assigned you any tokens')).toBeVisible();
          await Util.takeAndVerifyScreenshot(page2, browserName, deviceName, 'share-joined-map');
          await page2.click('.toast-header .close');

          // Check the player list
          await page2.click('[title="Players"]');
          await expect(page2.locator(`[aria-label="Player ${user.displayName}"]`)).toBeVisible();
          await Util.takeScreenshot(page2, browserName, deviceName, 'share-joined-map-players');
          await expect(page2.locator(`[aria-label="Player ${user2.displayName}"]`)).toBeVisible();
          await expect(page2.locator(`[title="Player ${user.displayName} is the owner"]`)).toBeVisible();
          await expect(page2.locator(`[title="Player ${user2.displayName} has no token"]`)).toBeVisible();
        }

        // Open the "Shared with me" page, the shared adventure should be there
        await Util.ensureNavbarExpanded(page2, deviceName);
        // TODO I think there's something up with Webkit and that map page
        if (browserName === 'webkit') {
          await page2.goto("http://localhost:5000/shared");
        } else {
          await page2.click('text="Shared with me"');
        }
        await expect(page2.locator('h5 >> text="Adventures shared with me"')).toBeVisible();

        // Expand accordion on phones
        if (Util.isPhone(deviceName)) {
          const adventureAccordion = await page2.waitForSelector('text="Test adventure"');
          await adventureAccordion.scrollIntoViewIfNeeded();
          await adventureAccordion.click();
        }

        const openAdventure = await page2.waitForSelector('text="Open adventure"'); // I want it in the screenshot :)
        await Util.takeScreenshot(page2, browserName, deviceName, 'share-shared-with-me');

        // Clicking "Open adventure" should get us back to the adventure page
        await openAdventure.click();
        await expect(page2.locator('.card-text >> text="Here be dragons"')).toBeVisible();
        await Util.takeScreenshot(page2, browserName, deviceName, 'share-end');
      } finally {
        await page2.close();
        await context2.close();
      }
    });
  });
});
