// Listen on a specific host via the HOST environment variable
var host = process.env.HOST || '0.0.0.0';
// Listen on a specific port via the PORT environment variable
var port = process.env.PORT || 8080;

// Grab the blacklist from the command-line so that we can update the blacklist without deploying
// again. CORS Anywhere is open by design, and this blacklist is not used, except for countering
// immediate abuse (e.g. denial of service). If you want to block all origins except for some,
// use originWhitelist instead.
var originBlacklist = parseEnvList(process.env.CORSANYWHERE_BLACKLIST);
var originWhitelist = parseEnvList(process.env.CORSANYWHERE_WHITELIST);
function parseEnvList(env) {
  if (!env) {
    return [];
  }
  return env.split(',');
}

// Set up rate-limiting to avoid abuse of the public CORS Anywhere server.
var checkRateLimit = require('./lib/rate-limit')(process.env.CORSANYWHERE_RATELIMIT);

var cors_proxy = require('./lib/cors-anywhere');
const http = require('http');
const TARGET_URL = process.env.TARGET_URL; // <--- CHANGE THIS
if (!TARGET_URL) {
    throw new Error('TARGET_URL is not set');
}

const corsAnywhereOptions = {
  originBlacklist: originBlacklist,
  originWhitelist: originWhitelist,
  requireHeader: [
                  //'origin',
                  //'x-requested-with'
  ],
  checkRateLimit: checkRateLimit,
  removeHeaders: [
    'cookie',
    'cookie2',
    // Strip Heroku-specific headers
    'x-request-start',
    'x-request-id',
    'via',
    'connect-time',
    'total-route-time',
    // Other Heroku added debug headers
    // 'x-forwarded-for',
    // 'x-forwarded-proto',
    // 'x-forwarded-port',
    // Added to adapt to NC trusted domains https://docs.nextcloud.com/server/30/admin_manual/installation/installation_wizard.html#trusted-domains
    // 'host', // nc seems to work fine even if this his fowarded
    // 'origin', // nc seems to work even if this is forwarded
    'x-forwarded-host', // definitely need to remove this one!
  ],
  redirectSameOrigin: true,
  httpProxyOptions: {
    // Do not add X-Forwarded-For, etc. headers, because Heroku already adds it.
    xfwd: false,
  },
}
var httpProxy = require('http-proxy');
const proxy = httpProxy.createServer(corsAnywhereOptions.httpProxyOptions);
const corsHandler = cors_proxy.getHandler(corsAnywhereOptions, proxy);
// 3. Create a standard Node.js server to wrap the handler.
const server = http.createServer((req, res) => {
  // The original incoming path, e.g., "/fish" or "/api/data?id=123"
  const originalPath = req.url;

  // The new, modified path that cors-anywhere understands
  const newPath = `/${TARGET_URL}${originalPath}`;
  console.log("newPath", newPath);

  // Log the transformation for debugging
  console.log(`Proxying request: ${req.method} ${originalPath} -> ${newPath}`);

  // Modify the request URL before passing it to the cors-anywhere handler
  req.url = newPath;

  // 4. Pass the modified request to the cors-anywhere handler.
  corsHandler(req, res);
});

server.listen(port, host, function() {
  console.log(`✅ Running DEDICATED CORS Anywhere on ${host}:${port}`);
  console.log(`🚀 Proxying all requests to: ${TARGET_URL}`);
});