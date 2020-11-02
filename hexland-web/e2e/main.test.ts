import * as path from 'path';

import { chromium, devices, firefox, webkit, Browser, BrowserContext, Page } from 'playwright';

import { SCREENSHOTS_PATH, VIDEOS_PATH } from './globals';

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
});
