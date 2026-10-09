# Historical Super Rare integration

Source: the user's DevTools script supplied October 9, 2026. Not verified against the live site during skill creation. Its target was BIGBANG on October 11, 2026, opening October 9 at 10:00 UTC+08:00 and closing October 11 at 21:00 UTC+08:00. These are provenance, not reusable defaults.

On `https://superrareshop.com/appointment`, the script reads `bb_auth_USER.token` or `bb_token`, plus `bb_device_id`, inside the user's browser. Requests send `Authorization: Bearer …` and `X-Device-Id` to same-origin `/api`, with same-origin credentials, redirect rejection, and a 15-second timeout. Never retrieve these values for the assistant or save them in generated files.

| Path beneath `/api` | Method | Expected purpose / fields |
| --- | --- | --- |
| `/appointments/mine?locale=en` | GET | Booking array: `slotDate`, `status`; ignore `CANCELLED`, `EXPIRED` |
| `/appointments/days?locale=en` | GET | Day array: `id`, `slotDate`, `activityName`, `venue`, `bookState` (`BEFORE`, `OPEN`) |
| `/appointments/days/{id}/join` | POST | Join queue; result `state` |
| `/appointments/days/{id}/heartbeat` | POST | Continue queue; `QUEUING`, `HOLD`, `ADMITTED` |
| `/appointments/days/{id}/slots?locale=en` | GET | Slot array: `id`, `quota`, `booked`, `startTime`, `endTime` |
| `/appointments` | POST | Submit `{ "slotId": id }` |

The source expects `{ code, message, data }`. The reusable template requires numeric `code: 0` for success and stops on unknown envelopes. Retryable business rejection requires HTTP success, numeric nonzero code, and an exact message:

- Slot full: `该时段已约满`
- Not open: `该日预约未开放` or `不在该日预约时间内`

A transport failure or unsuccessful HTTP status does not establish that a write was rejected. Do not broaden retry classification using substring matching. Queue heartbeat interval: four seconds. Explicit not-open rejection permits at most 30 join attempts. Unknown queue states stop execution.

Event matching is a case-insensitive literal substring across activity name and venue. Slot times must be zero-padded `HH:MM` or `HH:MM:SS`. Capacity fields must be finite, nonnegative numbers or numeric strings. Malformed data stops selection. Payment, ticket purchase, multi-account booking, and CAPTCHA handling are not implemented.

`sessionStorage` stores a submission marker scoped to the date. It remains for uncertain or accepted-but-unverified submissions. Same-tab reruns reconcile existing bookings first, then stop if unresolved. This is not a cross-tab lock: run only one booking tab. If the API changes, inspect authorized public UI behavior and revise this reference and the template together; do not guess mutation endpoints.
