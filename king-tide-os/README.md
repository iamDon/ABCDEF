# King Tide OS

**One login. One dashboard. One business snapshot.**

A read-only visibility layer over the tools King Tide Concepts already uses. The
external tools stay the systems of record; King Tide OS only shows what they hold.

This folder is the first vertical slice: **Zoho Bigin → Bigin adapter → Customer
logic → dashboard → acceptance tests**. Projects, announcements and finance are
placeholders (sample data in demo mode, "not connected yet" in live mode).

## Run it

Needs Node.js 22 or newer. There is nothing to install — no dependencies, no database.

```bash
npm start
```

Open http://localhost:3000. With no configuration it runs in **demo mode**:
fictional customers, fictional founders, no external calls. Pick a sample role on
the sign-in page; the one-time code is shown on screen.

```bash
npm test
```

## Connect real Zoho Bigin data

1. Copy `.env.example` to `.env`.
2. In the [Zoho API Console](https://api-console.zoho.com) create a **Self Client**
   and generate a refresh token with only these read scopes:
   `ZohoBigin.modules.pipelines.READ,ZohoBigin.settings.fields.READ`
3. Fill in `ZOHO_CLIENT_ID`, `ZOHO_CLIENT_SECRET`, `ZOHO_REFRESH_TOKEN`.
4. Set `KTOS_DATA_MODE=live` and list the approved founders in `KTOS_USERS`.
5. `npm start`.

In live mode the sign-in code is written to the server log until an email
provider is chosen (see "Not done yet").

## How it is put together

```
Browser (public/)                 no credentials, talks only to /api
   │
server/app.js                     authentication → authorization → route
   │
server/customers/customerLogic.js King Tide OS rules: Unassigned, empty state,
   │                              unavailable state, stage counts, last refresh
server/integrations/bigin/
   biginAdapter.js                Bigin fields → Customer (only file that knows Bigin field names)
   zohoBiginClient.js             OAuth + GET requests to Bigin (live mode)
   sampleBiginClient.js           fictional records in Bigin's raw shape (demo mode)
```

| Other pieces | File |
| --- | --- |
| Passwordless sign-in, sessions | `server/auth/authService.js` |
| Role → what each role may see | `server/auth/roles.js` |
| Integration status / last successful refresh | `server/integrations/health.js` |
| Placeholder projects / announcements / finance | `server/modules/placeholderModules.js` |
| Wiring of all the above | `server/compose.js` |

The Customer model the dashboard uses:
`customerId, customerName, stage, accountManager, pipeline, lastModified, sourceSystem, sourceRecordUrl`.

## Requirements → tests

| Requirement | Test (in `test/`) |
| --- | --- |
| R-01 Customer visibility | TC-01, TC-03 |
| R-02 Customer ownership | TC-01, TC-06 |
| R-03 Project visibility | not implemented — placeholder only |
| R-04 Role-based access | TC-07, "R-04 role-based access" |
| R-05 Integration failure isolation | TC-04, TC-04b, TC-05 |
| R-06 Data accuracy | TC-02, TC-02b, "Brief example" |
| R-07 Credential protection | "R-07 credentials never reach the browser", TC-04, TC-05 |

The tests run the real server against a fake Zoho, so they need no credentials.
To show failure isolation by hand, start with `KTOS_SIMULATE_BIGIN_OUTAGE=true`.

## Look and feel

Styled after kingtideconcepts.com (cream, navy, tide teal, gold; Cormorant
Garamond headlines, Manrope text — both bundled in `public/fonts/`, no external
requests). `public/logo.svg` is a hand-traced copy of the company logo; replace
it and `public/favicon.svg` with the official artwork when convenient.

## Not done yet

- **Verified against a real Bigin account.** The Zoho client follows the Bigin v2
  API (`/bigin/v2/Pipelines`, refresh-token OAuth) but has only run against the
  fake Zoho in the tests. Field names or scopes may need small adjustments.
- **Email delivery of sign-in codes.** Swap `consoleCodeSender` in
  `server/auth/authService.js` for a real provider.
- **Role views.** The split in `server/auth/roles.js` (finance: CEO only;
  integration status: CEO and CTO) is a starting point to confirm with the founders.
- **Caching.** None; every refresh asks Bigin. If added, the UI must show
  "Last successful update" and that the data may be outdated.
- Sessions live in memory, so a server restart signs everyone out.
