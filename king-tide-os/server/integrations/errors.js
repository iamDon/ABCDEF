// A failure in an external system. `kind` is safe to log and show in the
// integration status panel; the message never contains credentials or raw
// vendor responses.
export class IntegrationError extends Error {
  constructor(kind, message) {
    super(message);
    this.name = 'IntegrationError';
    this.kind = kind; // 'auth' | 'unavailable' | 'bad_response' | 'not_configured'
  }
}
