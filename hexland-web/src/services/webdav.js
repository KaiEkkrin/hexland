// eslint-disable-next-line
import { createClient } from 'webdav/web';

// A little bit of wrapping around the bits of the webdav library that I want.
// I do this because webdav doesn't have any type information available and I
// don't feel like declaring all of it myself

export function createWebDAV(location) {
  // return window.WebDAV.createClient(location);
  return createClient(location);
}