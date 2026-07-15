// oauth-server.js
// Implicit OAuth callback listener (no client secret).
// Access token arrives in the URL hash; this page displays it so you can
// paste OAUTH_TOKEN into .env manually. Nothing is written to disk.

import { config as loadDotenv } from 'dotenv';
import express from 'express';
import { buildAuthorizeURL } from './oauth-url.js';

loadDotenv({ path: process.env.ENV_PATH || '.env', quiet: true });

const app = express();

const CLIENT_ID = process.env.CLIENT_ID;
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'http://localhost:9070';
const PORT = Number(process.env.OAUTH_PORT || 9070);

if (!CLIENT_ID) {
	console.error('CLIENT_ID is required in .env');
	process.exit(1);
}

const authURL = buildAuthorizeURL(CLIENT_ID, REDIRECT_URI);

console.log('\nOpen this URL (while signed in as the BOT account):\n');
console.log(authURL);
console.log(`\nOAuth callback listening on ${REDIRECT_URI}`);
console.log('After approving, copy the access token into .env as OAUTH_TOKEN=...\n');

app.get('/', (req, res) => {
	res.send(`<!doctype html>
<html>
<head><title>Twitch OAuth</title></head>
<body>
  <h1>Twitch Implicit OAuth</h1>
  <pre id="out">Reading token from URL hash...</pre>
  <script>
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('access_token');
    const error = params.get('error');
    const out = document.getElementById('out');

    if (error) {
      out.textContent = 'Error: ' + error + ' ' + (params.get('error_description') || '');
    } else if (!token) {
      out.textContent = 'No access_token in URL hash. Open the authorize URL from the logs first.';
    } else {
      out.textContent =
        'SUCCESS — copy this into .env, then start the bot:\\n\\n' +
        'OAUTH_TOKEN=' + token;
    }
  </script>
</body>
</html>`);
});

app.listen(PORT, '0.0.0.0', () => {
	console.log(`OAuth listener running on port ${PORT}`);
});
