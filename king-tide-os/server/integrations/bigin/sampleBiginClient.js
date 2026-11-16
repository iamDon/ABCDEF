// Stand-in for ZohoBiginClient in demo mode. It returns fictional records in
// Bigin's own raw shape, so the demo exercises the same adapter and mapping
// code as production without touching confidential data.
import { IntegrationError } from '../errors.js';

const owner = (name) => ({ name, id: `u-${name.split(' ')[0].toLowerCase()}` });
const deal = (id, name, stage, ownerName, modified) => ({
  id,
  Deal_Name: name,
  Stage: stage,
  Owner: ownerName ? owner(ownerName) : null,
  Pipeline: { name: 'Sales Pipeline', id: 'p-1' },
  Sub_Pipeline: 'Sales Pipeline Standard',
  Account_Name: { name, id: `a-${id}` },
  Modified_Time: modified,
});

export const SAMPLE_STAGES = [
  'Contacted',
  'Contacted Again',
  'Contract Phase',
  'Paid Phase',
  'Development Phase',
  'Follow-up',
  'Onboarding',
];

export const SAMPLE_PIPELINE_RECORDS = [
  deal('1001', 'High Wire Electric', 'Development Phase', 'Marina Ellis', '2026-11-15T15:42:00-05:00'),
  deal('1002', 'Masonboro Marine Supply', 'Contract Phase', 'Cole Banks', '2026-11-14T10:05:00-05:00'),
  deal('1003', 'Cape Fear Dental Group', 'Onboarding', 'Sandy Shoals', '2026-11-13T16:20:00-05:00'),
  deal('1004', 'Pamlico Oyster Co.', 'Contacted', 'Reed Marsh', '2026-11-13T09:12:00-05:00'),
  deal('1005', 'Currituck Outfitters', 'Paid Phase', 'Marina Ellis', '2026-11-12T13:48:00-05:00'),
  deal('1006', 'Bogue Banks Realty', 'Contacted Again', null, '2026-11-11T11:30:00-05:00'),
  deal('1007', 'Albemarle Family Law', 'Follow-up', 'Wren Calloway', '2026-11-10T14:02:00-05:00'),
  deal('1008', 'Roanoke Roasters', 'Development Phase', 'Cole Banks', '2026-11-09T08:55:00-05:00'),
  deal('1009', 'Core Sound Boatworks', 'Contacted', 'Sandy Shoals', '2026-11-06T15:15:00-05:00'),
];

export class SampleBiginClient {
  constructor({ simulateOutage = false } = {}) {
    this.simulateOutage = simulateOutage;
  }

  async listPipelineRecords() {
    if (this.simulateOutage) throw new IntegrationError('unavailable', 'Simulated Bigin outage.');
    return SAMPLE_PIPELINE_RECORDS;
  }

  async listStageNames() {
    if (this.simulateOutage) throw new IntegrationError('unavailable', 'Simulated Bigin outage.');
    return SAMPLE_STAGES;
  }
}
