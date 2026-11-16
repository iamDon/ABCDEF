// Projects, finance and the calendar are not integrated yet. In demo mode
// they return clearly-labelled fictional data so the dashboard can be shown
// end to end; in live mode they say plainly that they are not connected.
const notConnected = (system) => ({
  status: 'not_connected',
  message: `${system} is not connected yet.`,
});

const SAMPLE = {
  projects: {
    status: 'ok',
    isSampleData: true,
    sourceSystem: 'Zoho Projects',
    projects: [
      { name: 'High Wire Electric — Dispatch Assistant', owner: 'Cole Banks', status: 'On track', nextMilestone: 'Pilot with field crews', due: '2026-12-04' },
      { name: 'Roanoke Roasters — Order Forecasting', owner: 'Reed Marsh', status: 'At risk', nextMilestone: 'Data cleanup sign-off', due: '2026-11-20' },
      { name: 'Cape Fear Dental — Front Desk Automation', owner: 'Sandy Shoals', status: 'On track', nextMilestone: 'Staff onboarding session', due: '2026-11-24' },
      { name: 'Currituck Outfitters — IT Refresh', owner: 'Wren Calloway', status: 'Not started', nextMilestone: 'Kickoff call', due: '2026-12-01' },
    ],
  },
  calendar: {
    status: 'ok',
    isSampleData: true,
    sourceSystem: 'Google Calendar',
    events: [
      { title: 'Founders sync', when: '2026-11-19T09:00:00-05:00', where: 'Video call' },
      { title: 'Cape Fear Dental — staff onboarding session', when: '2026-11-24T13:00:00-05:00', where: 'On site, Wilmington' },
      { title: 'Quarterly planning', when: '2026-12-02T10:00:00-05:00', where: 'Office' },
    ],
  },
  finance: {
    status: 'ok',
    isSampleData: true,
    sourceSystem: 'Zoho Books',
    figures: [
      { label: 'Invoiced this month', value: '$18,400' },
      { label: 'Outstanding invoices', value: '$6,250' },
      { label: 'Paid this month', value: '$12,150' },
    ],
  },
};

const SYSTEMS = { projects: 'Zoho Projects', calendar: 'The shared calendar', finance: 'Finance' };

export function createPlaceholderModules({ dataMode }) {
  return {
    get(name) {
      return dataMode === 'demo' ? SAMPLE[name] : notConnected(SYSTEMS[name]);
    },
  };
}
