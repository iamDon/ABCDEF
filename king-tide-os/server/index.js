import http from 'node:http';
import { compose } from './compose.js';
import { loadConfig } from './config.js';

try {
  process.loadEnvFile(); // reads .env when present
} catch {
  // no .env file: rely on real environment variables
}

const config = loadConfig();
const { handler } = compose(config);

http.createServer(handler).listen(config.port, () => {
  console.log(`King Tide OS running at http://localhost:${config.port} (${config.dataMode} data)`);
  if (config.dataMode === 'live' && config.users.length === 0) {
    console.warn('No approved users configured. Set KTOS_USERS so someone can sign in.');
  }
  if (config.dataMode === 'live' && config.showLoginCodes) {
    console.warn('KTOS_SHOW_LOGIN_CODES is on with live data: sign-in codes are shown on screen. Turn it off outside demos.');
  }
});
