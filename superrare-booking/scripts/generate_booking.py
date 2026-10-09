#!/usr/bin/env python3
"""Generate a same-site DevTools script; never makes network requests."""
import argparse
import datetime as dt
import json
from pathlib import Path
import re


def timestamp(value):
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:Z|[+-]\d{2}:\d{2})", value):
        raise ValueError("timestamps need seconds and an explicit offset, e.g. 2027-10-09T10:00:00+08:00")
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--event-name", required=True)
    parser.add_argument("--event-date", required=True)
    parser.add_argument("--opens-at", required=True)
    parser.add_argument("--closes-at", required=True)
    parser.add_argument("--allowed-start-time", action="append", default=[])
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    try:
        if not args.event_name.strip():
            raise ValueError("event name cannot be empty")
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", args.event_date):
            raise ValueError("event date must be YYYY-MM-DD")
        dt.date.fromisoformat(args.event_date)
        opening, closing = timestamp(args.opens_at), timestamp(args.closes_at)
        if closing <= opening:
            raise ValueError("closing must be after opening")
        if closing <= dt.datetime.now(dt.timezone.utc):
            raise ValueError("booking window has already ended")
        for value in args.allowed_start_time:
            if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", value):
                raise ValueError("allowed start times must be 24-hour HH:MM")
    except ValueError as error:
        parser.error(str(error))
    config = {
        "eventName": args.event_name.strip(), "eventDate": args.event_date,
        "opensAt": args.opens_at, "closesAt": args.closes_at,
        "allowedStartTimes": sorted(set(args.allowed_start_time)),
    }
    template = (Path(__file__).resolve().parent.parent / "assets/booking.template.js").read_text()
    marker = "/*__BOOKING_CONFIG__*/"
    if template.count(marker) != 1:
        raise SystemExit("Template must contain exactly one configuration marker")
    source = template.replace(marker, json.dumps(config, ensure_ascii=True, indent=2))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(source + "\n")
    print(f"Created {args.output}; no booking was executed.")


if __name__ == "__main__":
    main()
