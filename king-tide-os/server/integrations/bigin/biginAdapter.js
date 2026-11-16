// Bigin Integration Adapter: the only place that knows Bigin field names.
// It turns raw Bigin deal records into King Tide OS customers, so replacing
// Bigin later means replacing this folder and nothing else.
export const SOURCE_SYSTEM = 'Zoho Bigin';

const text = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
// Bigin lookups arrive as { name, id }; some fields arrive as plain strings.
const nameOf = (value) => text(value) ?? text(value?.name);

export function mapBiginRecordToCustomer(record, { recordUrlTemplate = '' } = {}) {
  const id = text(String(record.id ?? ''));
  return {
    customerId: id,
    customerName: text(record.Deal_Name) ?? nameOf(record.Account_Name) ?? 'Unnamed customer',
    stage: text(record.Stage), // exactly as configured in Bigin; null when not set
    accountManager: nameOf(record.Owner), // null when Bigin has no owner
    pipeline: nameOf(record.Pipeline) ?? text(record.Sub_Pipeline),
    lastModified: text(record.Modified_Time),
    sourceSystem: SOURCE_SYSTEM,
    sourceRecordUrl: id && recordUrlTemplate ? recordUrlTemplate.replace('{id}', encodeURIComponent(id)) : null,
  };
}

export class BiginAdapter {
  // client: ZohoBiginClient in live mode, SampleBiginClient in demo mode.
  constructor({ client, recordUrlTemplate = '' }) {
    this.client = client;
    this.recordUrlTemplate = recordUrlTemplate;
  }

  // -> { customers: Customer[], stageOrder: string[] | null }
  async fetchCustomers() {
    const records = await this.client.listPipelineRecords();
    const customers = records.map((r) => mapBiginRecordToCustomer(r, { recordUrlTemplate: this.recordUrlTemplate }));

    // Stage order is a nice-to-have; if it cannot be read (for example the
    // token lacks the settings scope) customers are still shown.
    let stageOrder = null;
    try {
      stageOrder = await this.client.listStageNames();
    } catch {
      stageOrder = null;
    }
    return { customers, stageOrder };
  }
}
