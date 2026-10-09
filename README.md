# Super Rare Booking

A reusable Codex skill that prepares event-specific appointment-booking scripts for superrareshop.com.

## Download and install

[Download the skill ZIP](https://github.com/Benedict30/superrare-booking/raw/refs/heads/main/downloads/superrare-booking.zip)

1. Download and unzip the archive.
2. Copy the entire `superrare-booking` folder into `~/.codex/skills/`.
3. Keep `SKILL.md`, `agents`, `scripts`, `assets`, and `references` together.
4. Start a new Codex chat and invoke `$superrare-booking`.

Example prompt:

> Use $superrare-booking for [event] on [appointment date], opening at [timestamp and timezone], closing at [timestamp and timezone]. Choose the earliest available slot.

## What it does

- Generates a script offline using the event details you supply.
- Waits for the configured opening time and follows the normal admission queue.
- Selects the earliest available slot, or the earliest matching an allowed start time.
- Checks existing bookings, limits retries, and stops after uncertain submissions to reduce duplicate bookings.

Generating a script does not make a booking. The generated script is run separately in DevTools on `https://superrareshop.com/appointment`; it asks for confirmation before using the existing same-site login and attempting a real appointment. Keep the tab open and computer awake. Browser integrations may only support generation, not direct script execution.

This is for appointment slots, not concert tickets. Availability and queue position are not guaranteed. Verify the current event details and site behavior before use; the included API reference documents historical assumptions. No credentials, booking screenshots, or personal booking records are included.

## Local validation

Requires Python 3 for generation and Node.js for the offline checks.

```sh
node superrare-booking/scripts/test_booking.cjs
```

The test suite uses mocked network requests, storage, clocks, and dialogs; it does not make live bookings.
