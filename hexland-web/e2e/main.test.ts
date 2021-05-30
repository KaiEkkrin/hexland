import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

import { chromium, devices, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';
import { from, Observable } from 'rxjs';
import { concatMap, last, map } from 'rxjs/operators';

import { LOG_PATH, VIDEOS_PATH } from './globals';
import { BrowserName, DeviceName, TestState } from './types';
import * as Oob from './oob';
import * as Util from './util';

import { toMatchImageSnapshot } from 'jest-image-snapshot';
expect.extend({ toMatchImageSnapshot });

type ConfigTuple = [BrowserName, DeviceName];

const browsers = {
  chromium: chromium,
  firefox: firefox,
  webkit: webkit,
};

// Extra test devices to represent PCs, Macs
// TODO: should set userAgent, etc. -- hopefully defaults will be provided in the future
// (Ask Dave...)
const allDevices = {
  ...devices,
  Desktop: {
    viewport: {
      width: 1920,
      height: 1080
    }
  },
  Laptop: {
    viewport: {
      width: 1366,
      height: 768
    }
  },
};

describe.each([
  <ConfigTuple>['chromium', 'iPhone 7'],
  //<ConfigTuple>['webkit', 'iPhone 7'], -- "invalid frame size" reported
  <ConfigTuple>['chromium', 'Pixel 2'],
  <ConfigTuple>['chromium', 'Laptop'],
  <ConfigTuple>['chromium', 'Desktop'],
  <ConfigTuple>['firefox', 'Laptop'],
  <ConfigTuple>['firefox', 'Desktop'],
  <ConfigTuple>['webkit', 'Laptop'],
  <ConfigTuple>['webkit', 'Desktop'],
])('Basic tests', (browserName, deviceName) => {
  // Some of these tests can take a while.  We define a long test timeout, but a
  // shorter timeout for individual page operations because each one shouldn't
  // take very long
  const longTestTimeout = 180000;
  const pageTimeout = 8000;
  const pageNavigationTimeout = 12000;

  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let state: TestState;

  let loggingDone: Promise<void>;

  // *** SETUP AND TEARDOWN ***

  beforeAll(async () => {
    browser = await browsers[browserName].launch();
  });

  beforeEach(async () => {
    expect(allDevices).toHaveProperty(deviceName);
    context = await browser.newContext({
      ...allDevices[deviceName],
      videosPath: path.join(VIDEOS_PATH, `${browserName}-${deviceName}.webm`)
    });
    page = await context.newPage();
    page.setDefaultNavigationTimeout(pageNavigationTimeout);
    page.setDefaultTimeout(pageTimeout);
    state = {
      page: page,
      browserName: browserName,
      deviceName: deviceName,
    };

    // Stream the console log to file
    try {
      await promisify(fs.access)(LOG_PATH);
    } catch {
      await promisify(fs.mkdir)(LOG_PATH);
    }
    const fh = await promisify(fs.open)(
      path.join(LOG_PATH, `${browserName}-${deviceName}.log`),
      'w'
    );

    const messages = new Observable<string | null>(obs => {
      page.on('console', msg => {
        const ty = msg.type().padStart(10, ' ');
        const text = msg.text();
        obs.next(`${ty} : ${text}\n`);
      });

      page.on('close', () => {
        obs.next(null);
        obs.complete();
      });
    });

    const write = promisify(fs.write);
    const close = promisify(fs.close);
    loggingDone = messages.pipe(concatMap(
      m => m !== null ? from(write(fh, m)).pipe(map(_ => {})) : from(close(fh))
    ), last()).toPromise();
    
    // Wait for front page to load and accept cookies before running any other tests
    await page.goto('http://localhost:5000/');
    await expect(page).toHaveSelector('.Introduction-image');
    await page.click('.App-consent-card .btn-success');
  });

  afterEach(async () => {
    await page.close();
    await loggingDone;
  });

  afterAll(async () => {
    await browser.close();
  });

  // *** TEST CASES ***

  it(`view front page (${browserName} ${deviceName})`, async () => {
    await page.waitForTimeout(500);
    await Util.takeScreenshot(state, 'view-front-page');
  });

  it(`create account and login (${browserName} ${deviceName})`, async () => {
    // Sign up a new user
    const user = await Util.signUp(deviceName, page);

    // I should now see my new user name appear in the nav bar.
    await Util.ensureNavbarExpanded(deviceName, page);
    await expect(page).toHaveSelector(`css=.dropdown >> text=${user.displayName}`);

    // Click the navbar dropdown 
    await page.click(`css=.dropdown >> text=${user.displayName}`);
    await Util.takeScreenshot(state, 'create-account-navbar-dropdown');
    await page.click('text="Edit profile"');

    // Change the display name
    expect(await page.getAttribute('[id=nameInput]', 'value')).toBe(user.displayName);
    await page.fill('[id=nameInput]', `Re-test ${user.number}`);
    await Util.takeScreenshot(state, 'create-account-edit-profile');
    await page.click('text="Save profile"');

    // This should have edited the name in the nav bar
    await expect(page).toHaveSelector(`css=.dropdown >> text=Re-test ${user.number}`);

    // If we log out, we should get `Sign up/Login` back:
    await page.click('text="Log out"');
    await expect(page).toHaveSelector('text="Sign up/Login"');

    // Check we can log back in again too :)
    await Util.signIn(page, user);
    await Util.ensureNavbarExpanded(deviceName, page);
    await expect(page).toHaveSelector(`css=.dropdown >> text=${user.displayName}`);

    // This user should not be marked as verified (yet)
    await expect(page).toHaveSelector(`[title="${user.displayName} (Not verified)"]`);

    // Verify this user
    await Oob.verifyEmail(user.email);
    await page.reload();
    await Util.ensureNavbarExpanded(deviceName, page);

    // This user should now be marked as verified
    await expect(page).toHaveSelector(`css=.dropdown >> text=${user.displayName}`);
    await expect(page).toHaveSelector(`[title="${user.displayName} (Verified)"]`);
    await Util.takeScreenshot(state, 'create-account-verified');
  });

  describe('Two-context tests', () => {
    let context2: BrowserContext;
    let page2: Page;
    let state2: TestState;

    beforeEach(async () => {
      context2 = await browser.newContext({
        ...allDevices[deviceName],
        videosPath: path.join(VIDEOS_PATH, `${browserName}-${deviceName}-c2.webm`)
      });
      page2 = await context2.newPage();
      page2.setDefaultNavigationTimeout(pageNavigationTimeout);
      page2.setDefaultTimeout(pageTimeout);
      state2 = { page: page2, deviceName: deviceName, browserName: browserName };

      await page2.goto('http://localhost:5000/');
      await expect(page2).toHaveSelector('.Introduction-image');
      await page2.click('.App-consent-card .btn-success');
    });

    afterEach(async () => {
      await page2.close();
    });

    it(`share adventure and map from home (${browserName} ${deviceName})`, async () => {
      // Sign up a new user
      const user = await Util.signUp(deviceName, page, 'User');

      await Util.createNewAdventure(page, 'Test adventure', 'Here be dragons');
      await expect(page).toHaveSelector('css=.h5 >> text="Test adventure"');
      await expect(page).toHaveSelector('css=.card-text >> text="Here be dragons"');
      await Util.whileNavbarExpanded(deviceName, page, async () => {
        await expect(page).toHaveSelector('css=[aria-label="Link to this adventure"] >> text="Test adventure"');
      });

      // Create new maps of each type making sure they look right
      await Util.createNewMap(page, 'Test map', 'Dragons lair', 'hex');
      await Util.verifyMap(
        browserName, deviceName, page, state,
        "Test adventure", "Here be dragons", "Test map", "share-create-map"
      );

      await Util.createNewMap(page, 'Test square map', 'Seedy tavern', 'square');
      await Util.verifyMap(
        browserName, deviceName, page, state,
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
      const user2 = await Util.signUp(deviceName, page2, 'User');

      // Go to the invite link and click.  There should be a suitable greeting
      await page2.goto("http://localhost:5000" + inviteLink);
      await expect(page2).toHaveSelector('text=Test adventure');
      await Util.takeScreenshot(state2, 'share-join-adventure');
      await page2.click('text="Join"');

      // This should take us back to the adventure page, which should now include
      // both usernames in the players list
      await expect(page2).toHaveSelector('css=.card-text >> text="Here be dragons"');
      await Util.takeScreenshot(state2, 'share-joined-adventure');
      await expect(page2).toHaveSelector(`css=[aria-label="Player ${user.displayName}"] >> text="${user.displayName}"`);
      await expect(page2).toHaveSelector(`css=[aria-label="Player ${user2.displayName}"] >> text="${user2.displayName}"`);

      // The adventure owner should see these same names pop up too
      // TODO webkit stops listening?!
      if (browserName === 'webkit') {
        await page.reload();
      }
      await expect(page).toHaveSelector(`css=[aria-label="Player ${user.displayName}"] >> text="${user.displayName}"`);
      await expect(page).toHaveSelector(`css=[aria-label="Player ${user2.displayName}"] >> text="${user2.displayName}"`);

      await Util.takeScreenshot(state2, 'share-joined-adventure-owner');

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
        await expect(page2).toHaveSelector('text=The map owner has not assigned you any tokens');
        await Util.takeAndVerifyScreenshot(state2, 'share-joined-map');
        await page2.click('.toast-header .close');

        // Check the player list
        await page2.click('[title="Players"]');
        await expect(page2).toHaveSelector(`[aria-label="Player ${user.displayName}"]`);
        await Util.takeScreenshot(state2, 'share-joined-map-players');
        await expect(page2).toHaveSelector(`[aria-label="Player ${user2.displayName}"]`);
        await expect(page2).toHaveSelector(`[title="Player ${user.displayName} is the owner"]`);
        await expect(page2).toHaveSelector(`[title="Player ${user2.displayName} has no token"]`);
      }

      // Open the "Shared with me" page, the shared adventure should be there
      await Util.ensureNavbarExpanded(deviceName, page2);
      // TODO I think there's something up with Webkit and that map page
      if (browserName === 'webkit') {
        await page2.goto("http://localhost:5000/shared");
      } else {
        await page2.click('text="Shared with me"');
      }
      await expect(page2).toHaveSelector('css=h5 >> text="Adventures shared with me"');

      // Expand accordion on phones
      if (Util.isPhone(deviceName)) {
        const adventureAccordion = await page2.waitForSelector('text="Test adventure"');
        await adventureAccordion.scrollIntoViewIfNeeded();
        await adventureAccordion.click();
      }

      const openAdventure = await page2.waitForSelector('text="Open adventure"'); // I want it in the screenshot :)
      await Util.takeScreenshot(state2, 'share-shared-with-me');

      // Clicking "Open adventure" should get us back to the adventure page
      await openAdventure.click();
      await expect(page2).toHaveSelector('css=.card-text >> text="Here be dragons"');
      await Util.takeScreenshot(state2, 'share-end');
    }, longTestTimeout);
  });
});
