import * as path from 'path';

import { chromium, devices, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';

import { SCREENSHOTS_PATH, VIDEOS_PATH } from './globals';

import { v4 as uuidv4 } from 'uuid';

type BrowserName = 
  'chromium' |
  'firefox' |
  'webkit';
type DeviceName =
  'iPhone 7' |
  'Desktop' |
  'Laptop' |
  'Pixel 2';

type ConfigTuple = [BrowserName, DeviceName];

type TestState = {
  page: Page,
  browserName: BrowserName,
  deviceName: DeviceName,
};

const browsers = {
  chromium: chromium,
  firefox: firefox,
  webkit: webkit,
};

// Extra test devices to represent PCs, Macs
// REVISIT: should set userAgent, etc. -- hopefully defaults will be provided in the future
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

async function takeScreenshot(state: TestState, message: string) {
  await state.page.screenshot({
    path: path.join(
      SCREENSHOTS_PATH, `${state.browserName}_${state.deviceName}_${message}.png`
    )
  });
}

let signupNumber = 0;

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
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;
  let state: TestState;

  async function ensureNavbarExpanded() {
    // On phones we'll get the collapsed hamburger thingy
    if (/(iPhone)|(Pixel)/.test(deviceName)) {
      await expect(page).toHaveSelector('.navbar-toggler');
      await page.click('.navbar-toggler');
    }
  }

  beforeAll(async () => {
    browser = await browsers[browserName].launch();
    expect(allDevices).toHaveProperty(deviceName);
    context = await browser.newContext({
      ...allDevices[deviceName],
      videosPath: path.join(VIDEOS_PATH, `${browserName}-${deviceName}.webm`)
    });
    page = await context.newPage();
    state = {
      page: page,
      browserName: browserName,
      deviceName: deviceName,
    };
    
    // Wait for front page to load and accept cookies before running any other tests
    await page.goto('http://localhost:5000/');
    await expect(page).toHaveSelector('.App-introduction-image');
    await page.click('.App-consent-card .btn-success');
  });

  afterAll(async () => {
    await page.close();
    await browser.close();
  });

  it(`view front page (${browserName} ${deviceName})`, async () => {
    await page.waitForTimeout(500);
    await takeScreenshot(state, 'view-front-page');
  });

  it(`create account and login (${browserName} ${deviceName})`, async () => {
    await ensureNavbarExpanded();

    // Go through the login page
    await page.click('text="Sign up/Login"');
    await expect(page).toHaveSelector('.App-login-text');
    await page.click('.App-header .btn-primary');
    await expect(page).toHaveSelector('.modal .tab-pane');

    // Fill in the form.  Take care to create unique email addresses because
    // we may be re-using the authentication emulator instance from another run
    const n = ++signupNumber;
    const email = `test${n}-${uuidv4()}@example.com`;
    await page.fill('[id=nameInput]', `Test ${n}`);
    await page.fill('[id=newEmailInput]', email);
    await page.fill('[id=newPasswordInput]', `test_password${n}`);
    await page.fill('[id=confirmPasswordInput]', `test_password${n}`);
    await takeScreenshot(state, 'create-account-new-user');

    // Sign up
    await page.click('text="Sign up"', { force: true });

    // Wait for the front page to come back
    await expect(page).toHaveSelector('.App-introduction-image');

    // A verification email should have been sent (click the toast off)
    await expect(page).toHaveSelector(`text="A verification email has been sent to ${email}"`);
    await page.click('.toast-header .close');

    // I should now see my new user name appear in the nav bar.
    await ensureNavbarExpanded();
    await expect(page).toHaveSelector(`css=.dropdown >> text=Test ${n}`);

    // Click the navbar dropdown 
    await page.click(`css=.dropdown >> text=Test ${n}`);
    await takeScreenshot(state, 'create-account-navbar-dropdown');
    await page.click('text="Edit profile"');

    // Change the display name
    expect(await page.getAttribute('[id=nameInput]', 'value')).toBe(`Test ${n}`);
    await page.fill('[id=nameInput]', `Re-test ${n}`);
    await takeScreenshot(state, 'create-account-edit-profile');
    await page.click('text="Save profile"');

    // This should have edited the name in the nav bar
    await expect(page).toHaveSelector(`css=.dropdown >> text=Re-test ${n}`);

    // If we log out, we should get `Sign up/Login` back:
    await page.click('text="Log out"');
    await expect(page).toHaveSelector('text="Sign up/Login"');
  });
});
