import { Page } from 'playwright';

export type BrowserName = 
  'chromium' |
  'firefox' |
  'webkit';

export type DeviceName =
  'iPhone 7' |
  'Desktop' |
  'Laptop' |
  'Pixel 2';

export type TestState = {
  page: Page,
  browserName: BrowserName,
  deviceName: DeviceName,
};