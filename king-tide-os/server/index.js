import http from 'node:http';
import { compose } from './compose.js';
import { loadConfig } from './config.js';

try {
  process.loadEnvFile(); // reads .env when present
} catch {
  // no .env file: rely on real environment variables
}

const config = loadConfig();
const { handler, emailConfigured } = compose(config);

http.createServer(handler).listen(config.port, () => {
  console.log(`King Tide OS running at http://localhost:${config.port} (${config.dataMode} data)`);
  if (config.usingSampleUsers) {
    console.log('Using the fictional sample founders. Add config/users.json to let the real founders sign in.');
  } else if (!emailConfigured) {
    console.warn('No mail server configured (SMTP_HOST): sign-in codes are written to this log instead of emailed.');
  }
  if (!config.usingSampleUsers && config.showLoginCodes) {
    console.warn('KTOS_SHOW_LOGIN_CODES is on with real founders: sign-in codes are shown on screen. Turn it off outside demos.');
  }
});
