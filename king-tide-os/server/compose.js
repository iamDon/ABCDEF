// Wires the layers together:  UI -> app -> logic -> adapter -> external API.
// Tests call this with a fake fetch or code sender to exercise the real wiring.
import { createApp } from './app.js';
import { AuthService } from './auth/authService.js';
import { consoleCodeSender, createSmtpCodeSender } from './auth/codeSenders.js';
import { CustomerLogic } from './customers/customerLogic.js';
import { BiginAdapter } from './integrations/bigin/biginAdapter.js';
import { SampleBiginClient } from './integrations/bigin/sampleBiginClient.js';
import { ZohoBiginClient } from './integrations/bigin/zohoBiginClient.js';
import { IntegrationHealth } from './integrations/health.js';
import { Announcements } from './modules/announcements.js';
import { createPlaceholderModules } from './modules/placeholderModules.js';

export function compose(config, { fetchImpl = fetch, codeSender, log = console.error } = {}) {
  const demo = config.dataMode === 'demo';

  const health = new IntegrationHealth();
  health.register('bigin', 'Zoho Bigin', demo ? 'sample' : 'pending', demo ? 'Showing sample data.' : 'Waiting for the first refresh.');
  health.register('projects', 'Zoho Projects', 'planned', 'Not connected yet.');
  health.register('finance', 'Finance (Zoho Books / Stripe / Mercury)', 'planned', 'Not connected yet.');
  health.register('calendar', 'Google Calendar', 'planned', 'Not connected yet.');
  health.register('communications', 'Slack', 'planned', 'Not connected yet.');

  const biginClient = demo
    ? new SampleBiginClient({ simulateOutage: config.simulateBiginOutage })
    : new ZohoBiginClient({ ...config.zoho, fetchImpl });
  const biginAdapter = new BiginAdapter({ client: biginClient, recordUrlTemplate: config.zoho.recordUrlTemplate });
  const customerLogic = new CustomerLogic({ adapter: biginAdapter, health, isSample: demo, log });

  // Codes go out by email when a mail server is configured, else to the server log.
  const emailConfigured = Boolean(config.smtp.host && config.smtp.from);
  const sender = codeSender || (emailConfigured ? createSmtpCodeSender(config.smtp) : consoleCodeSender);
  const auth = new AuthService({ users: config.users, codeSender: sender });
  const modules = createPlaceholderModules({ dataMode: config.dataMode });
  const announcements = new Announcements({ dataDir: config.dataDir, includeSamples: demo });

  return {
    handler: createApp({ config, auth, customerLogic, modules, announcements, health, log }),
    auth,
    health,
    emailConfigured,
  };
}
