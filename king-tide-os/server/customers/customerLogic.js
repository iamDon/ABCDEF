// Customer Logic: King Tide OS behaviour for the customer snapshot. It knows
// about Customers, not about Zoho — it works with any adapter that offers
// fetchCustomers() -> { customers, stageOrder }.
export const UNAVAILABLE_MESSAGE = 'Customer data is temporarily unavailable. Please try again later.';
export const EMPTY_MESSAGE = 'No customers currently available.';
export const UNASSIGNED = 'Unassigned';
export const NO_STAGE = 'No stage';

export class CustomerLogic {
  constructor({ adapter, health, integrationId = 'bigin', isSample = false, log = console.error }) {
    this.adapter = adapter;
    this.health = health;
    this.integrationId = integrationId;
    this.isSample = isSample;
    this.log = log;
  }

  // Never throws: a Bigin failure becomes a controlled "unavailable" result so
  // the rest of the dashboard keeps working.
  async getSnapshot() {
    let result;
    try {
      result = await this.adapter.fetchCustomers();
    } catch (err) {
      const kind = err?.kind || 'unavailable';
      this.health.recordFailure(this.integrationId, kind);
      this.log(`[customers] Bigin retrieval failed (${kind}): ${err?.name === 'IntegrationError' ? err.message : 'unexpected error'}`);
      return {
        status: 'unavailable',
        message: UNAVAILABLE_MESSAGE,
        lastSuccessfulRefresh: this.health.lastSuccess(this.integrationId),
      };
    }

    const customers = result.customers.map((c) => ({
      ...c,
      stage: c.stage ?? NO_STAGE,
      accountManager: c.accountManager ?? UNASSIGNED,
    }));

    return {
      status: 'ok',
      sourceSystem: customers[0]?.sourceSystem ?? 'Zoho Bigin',
      isSampleData: this.isSample,
      totalCustomers: customers.length,
      message: customers.length === 0 ? EMPTY_MESSAGE : null,
      stages: summarizeStages(customers, result.stageOrder),
      customers,
      lastSuccessfulRefresh: this.health.recordSuccess(this.integrationId),
    };
  }
}

// Counts customers per stage. Stages follow the order configured in Bigin when
// it is known; any stage not in that list (and all stages when the order is
// unknown) follows in the order Bigin returned the records. Never re-sorted.
export function summarizeStages(customers, stageOrder) {
  const counts = new Map((stageOrder || []).map((stage) => [stage, 0]));
  for (const c of customers) counts.set(c.stage, (counts.get(c.stage) || 0) + 1);
  return [...counts].map(([stage, count]) => ({ stage, count }));
}
