---
name: superrare-booking
description: Prepare reusable DevTools booking scripts for concert or event appointment slots on superrareshop.com, including opening-time waits, the normal admission queue, and earliest available slot selection. Use for Super Rare booking scripts or slot-booking help; other ticketing sites require their own verified workflow.
---

# Super Rare booking

Generate an event-specific JavaScript file from the user's previous Super Rare script. This reserves an appointment slot; do not describe it as purchasing a concert ticket or guaranteeing concert admission.

## Establish the booking details

Use details already supplied in the conversation. Obtain any missing event name, appointment date, opening and closing timestamps with explicit UTC offsets, and slot preference. Default to earliest available only if no narrower preference was given. The generator also accepts a list of acceptable start times and chooses the earliest among them. Resolve relative dates and ambiguous time zones before generating executable code. Never reuse the old BIGBANG dates by default.

When page access is available, inspect the relevant event page through the environment's authorized page-reading tools to corroborate dates and identity. Respect browser-tool restrictions; this skill does not grant permission to extract tokens or run arbitrary fetches through browser automation. Do not claim live verification when only the supplied script is available. Read [references/site-contract.md](references/site-contract.md) before adapting the integration; it records historical assumptions, not a verified current API.

## Generate the script

Run `scripts/generate_booking.py` from this skill's directory. It validates configuration and inserts serialized JSON into `assets/booking.template.js`; no network requests occur during generation. Example (illustrative dates, not defaults):

```sh
python3 scripts/generate_booking.py \
  --event-name 'BIGBANG' \
  --event-date 2027-10-11 \
  --opens-at '2027-10-09T10:00:00+08:00' \
  --closes-at '2027-10-11T21:00:00+08:00' \
  --output /absolute/path/to/outputs/superrare-booking.js
```

Add repeated `--allowed-start-time '14:00'` flags only to restrict acceptable slots. For a time range, translate it into verified available start times or explicitly adapt selection logic; never fall back to a disallowed time. Use the environment's designated output directory. Syntax-check generated code with `node --check` when available; do not execute it against the live site as a test.

Explain the configured event, date, opening time/offset, and selection policy beside the deliverable. State that running it submits one real appointment using the existing same-site login and needs the tab open and computer awake. The generated script includes an exact-target confirmation for manual DevTools use. Stop with `window.superRareBooking.stop()`; an in-flight request can still complete.

Creating a skill or generating code does not authorize executing a booking. If the user separately asks to book and has already authorized the concrete target, proceed within that scope using supported tools; do not demand duplicate approval merely because this skill exists. Otherwise deliver the reviewable script without launching it.

## Preserve the booking safeguards

- Restrict execution to `https://superrareshop.com/appointment`, same-origin requests, and the current account. Never collect, print, embed, or export credentials.
- Identify exactly one event day using the event name and date. Stop on missing, ambiguous, or unknown data.
- Check for an existing non-cancelled, non-expired booking on the date before joining. The date-only duplicate check is deliberately conservative; report a record without asserting it belongs to the requested event.
- Wait until the configured opening time. Follow the site's queue without bypassing admission, CAPTCHAs, rate limits, or account limits. Preserve four-second polling and the 30-attempt limit for explicit not-open rejections. Stop at closing, user stop, or unexpected responses.
- Retry a slot submission only for the documented explicit slot-full business rejection. After an uncertain write, reconcile with the booking list and stop without resubmitting. A per-tab session guard blocks fresh runs when an earlier submission is unresolved; do not clear it until the site's booking records resolve the outcome.
- After acceptance, check records and direct the user to `/appointment/codes`. Distinguish acceptance, a verified existing record, and uncertainty. Never promise a slot or describe generated code as an executed booking.

When modifying the template, run `node scripts/test_booking.cjs` for mocked behavioral checks. These perform no real bookings and do not establish current site compatibility.
