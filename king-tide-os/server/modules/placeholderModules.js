// Projects, communications and finance are not integrated yet. In demo mode
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
  communications: {
    status: 'ok',
    isSampleData: true,
    sourceSystem: 'King Tide OS',
    items: [
      { title: 'Founders sync moved to Thursday 9:00', from: 'Marina Ellis', when: '2026-11-16T08:30:00-05:00' },
      { title: 'Roanoke Roasters asked for a revised timeline', from: 'Reed Marsh', when: '2026-11-15T16:10:00-05:00' },
      { title: 'New inbound lead from the Wilmington chamber mixer', from: 'Sandy Shoals', when: '2026-11-14T12:45:00-05:00' },
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

const SYSTEMS = { projects: 'Zoho Projects', communications: 'Communications', finance: 'Finance' };

export function createPlaceholderModules({ dataMode }) {
  return {
    get(name) {
      return dataMode === 'demo' ? SAMPLE[name] : notConnected(SYSTEMS[name]);
    },
  };
}
