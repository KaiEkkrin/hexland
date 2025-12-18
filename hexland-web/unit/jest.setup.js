// Setup file for Jest tests

// Set test timeout to 30 seconds (default 5s is too short for Firebase emulator tests)
jest.setTimeout(30000);

// Provide fetch polyfill for Firebase Auth SDK in Node.js environments
// Node.js 18+ has native fetch, but Firebase Auth might need it globally
if (typeof global.fetch === 'undefined') {
  const nodeFetch = require('node-fetch');
  global.fetch = nodeFetch;
  global.Headers = nodeFetch.Headers;
  global.Request = nodeFetch.Request;
  global.Response = nodeFetch.Response;
}
