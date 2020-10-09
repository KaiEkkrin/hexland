import { IWebDAV } from "./interfaces";

const { createClient } = require('webdav');

// Here we create a client in the non-Web manner
// See https://www.npmjs.com/package/webdav

export function createWebDAV(location: any): IWebDAV {
  return createClient(location);
}