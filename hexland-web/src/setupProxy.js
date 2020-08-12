// From https://dev.to/captemulation/developing-and-deploying-create-react-app-to-multiple-firebase-environments-4e8h
// and https://create-react-app.dev/docs/proxying-api-requests-in-development/#configuring-the-proxy-manually
// Lets us provide Firebase auto-configuration to `yarn start` via `firebase serve`.

const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/__',
    createProxyMiddleware({
      target: 'http://localhost:4000'
    })
  );
};