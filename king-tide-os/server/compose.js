// Wires the layers together:  UI -> app -> logic -> adapter -> external API.
// Tests call this with a fake fetch or code sender to exercise the real wiring.
import { createApp } from './app.js';
import { AuthService, consoleCodeSender } from './auth/authService.js';
import { CustomerLogic } from './customers/customerLogic.js';
import { BiginAdapter } from './integrations/bigin/biginAdapter.js';
import { SampleBiginClient } from './integrations/bigin/sampleBiginClient.js';
import { ZohoBiginClient } from './integrations/bigin/zohoBiginClient.js';
import { IntegrationHealth } from './integrations/health.js';
import { createPlaceholderModules } from './modules/placeholderModules.js';

export function compose(config, { fetchImpl = fetch, codeSender = consoleCodeSender, log = console.error } = {}) {
  const demo = config.dataMode === 'demo';

  const health = new IntegrationHealth();
  health.register('bigin', 'Zoho Bigin', demo ? 'sample' : 'pending', demo ? 'Showing sample data.' : 'Waiting for the first refresh.');
  health.register('projects', 'Zoho Projects', 'planned', 'Not connected yet.');
  health.register('finance', 'Finance (Zoho Books / Stripe / Mercury)', 'planned', 'Not connected yet.');
  health.register('communications', 'Slack / Google Workspace', 'planned', 'Not connected yet.');

  const biginClient = demo
    ? new SampleBiginClient({ simulateOutage: config.simulateBiginOutage })
    : new ZohoBiginClient({ ...config.zoho, fetchImpl });
  const biginAdapter = new BiginAdapter({ client: biginClient, recordUrlTemplate: config.zoho.recordUrlTemplate });
  const customerLogic = new CustomerLogic({ adapter: biginAdapter, health, isSample: demo, log });

  const auth = new AuthService({ users: config.users, codeSender });
  const modules = createPlaceholderModules({ dataMode: config.dataMode });

  return { handler: createApp({ config, auth, customerLogic, modules, health }), auth, health };
}
