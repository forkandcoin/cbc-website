#!/usr/bin/env python3
"""Build assets/cbc/events.json from the public CBC Google Calendar ICS feed.

Runs in the deploy workflow before the S3 sync (and on a schedule) so the
events page calendar stays current without embedding Google's widget.
If the feed can't be fetched or parsed, the existing events.json is kept
and the script exits 0 so a deploy is never blocked by Google.

Requires: pip install icalendar recurring-ical-events
"""
import datetime as dt
import html
import json
import os
import re
import sys
import time
import urllib.request
from zoneinfo import ZoneInfo

import icalendar
import recurring_ical_events

CAL_ID = "chicagobitcoincollective@gmail.com"
ICS_URL = ("https://calendar.google.com/calendar/ical/"
           "chicagobitcoincollective%40gmail.com/public/basic.ics")
TZ = ZoneInfo("America/Chicago")
MONTHS_BACK = 3
MONTHS_AHEAD = 12
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "assets", "cbc", "events.json")
UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/124.0 Safari/537.36")
URL_RE = re.compile(r"https?://[^\s<>\"')\]]+")


def fetch(url, tries=4):
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=30) as r:
                data = r.read()
            if not data.startswith(b"BEGIN:VCALENDAR"):
                raise ValueError("response is not an ICS calendar")
            return data
        except Exception as e:  # noqa: BLE001
            last = e
            time.sleep(2 * (i + 1))
    raise RuntimeError(f"could not fetch ICS feed: {last}")


def clean_text(raw):
    raw = str(raw or "")
    raw = re.sub(r"(?i)<br\s*/?>|</p>|</div>|</li>", "\n", raw)
    # keep link targets from anchors before stripping tags
    raw = re.sub(r'(?i)<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>',
                 lambda m: m.group(2) if m.group(1) in m.group(2)
                 else f"{m.group(2)} {m.group(1)}", raw)
    raw = re.sub(r"<[^>]+>", "", raw)
    raw = html.unescape(raw)
    raw = re.sub(r"[ \t\u00a0]+", " ", raw)
    raw = re.sub(r"\n\s*\n+", "\n", raw)
    return raw.strip()


SKIP_LINK = re.compile(r"(meet\.google\.com|support\.google\.com|zoom\.us|teams\.microsoft)", re.I)
BOILERPLATE = re.compile(r"(?im)^\s*(join with google meet|learn more about meet at|join by phone|more phone numbers)\b.*$")


def first_link(text):
    for m in URL_RE.finditer(text or ""):
        url = m.group(0).rstrip(".,;")
        if not SKIP_LINK.search(url):
            return url
    return None


def to_local(v):
    if isinstance(v, dt.datetime):
        if v.tzinfo is None:
            v = v.replace(tzinfo=TZ)
        return v.astimezone(TZ), False
    return v, True  # date = all day


def month_shift(d, n):
    y, m = divmod(d.month - 1 + n, 12)
    return d.replace(year=d.year + y, month=m + 1, day=1)


def build(ics_bytes):
    cal = icalendar.Calendar.from_ical(ics_bytes)
    today = dt.datetime.now(TZ).date()
    start = month_shift(today, -MONTHS_BACK)
    end = month_shift(today, MONTHS_AHEAD + 1)
    out = []
    for ev in recurring_ical_events.of(cal).between(start, end):
        if str(ev.get("STATUS", "")).upper() == "CANCELLED":
            continue
        if str(ev.get("CLASS", "")).upper() in ("PRIVATE", "CONFIDENTIAL"):
            continue
        s, all_day = to_local(ev.decoded("DTSTART"))
        e_raw = ev.get("DTEND")
        e = to_local(ev.decoded("DTEND"))[0] if e_raw is not None else s
        if all_day:
            # ICS all-day DTEND is exclusive
            e_incl = e - dt.timedelta(days=1) if e > s else s
            s_str, e_str = s.isoformat(), e_incl.isoformat()
        else:
            s_str, e_str = s.isoformat(timespec="minutes"), e.isoformat(timespec="minutes")
        desc = clean_text(ev.get("DESCRIPTION"))
        link = str(ev.get("URL") or "") or first_link(desc)
        desc_plain = BOILERPLATE.sub("", URL_RE.sub("", desc))
        desc_plain = re.sub(r"[ \t]+", " ", re.sub(r"\n\s*\n+", "\n", desc_plain)).strip()
        out.append({
            "title": clean_text(ev.get("SUMMARY")) or "CBC Event",
            "start": s_str,
            "end": e_str,
            "allDay": all_day,
            "location": clean_text(ev.get("LOCATION")),
            "description": desc_plain[:400],
            "url": link,
        })
    out.sort(key=lambda x: (x["start"], x["title"]))
    return {
        "calendar": CAL_ID,
        "timezone": "America/Chicago",
        "generated": dt.datetime.now(TZ).isoformat(timespec="seconds"),
        "events": out,
    }


def main():
    try:
        data = build(fetch(os.environ.get("CBC_ICS_URL", ICS_URL)))
    except Exception as e:  # noqa: BLE001
        print(f"WARNING: keeping existing events.json ({e})", file=sys.stderr)
        return 0
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"Wrote {len(data['events'])} events to {os.path.relpath(OUT, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
