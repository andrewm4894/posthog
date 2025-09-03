#!/usr/bin/env python3
"""
Generate synthetic events for development and testing via /e endpoint.

This command generates realistic event data for development and testing purposes.
It supports various timestamp distributions, event types, and rate limiting options.
"""

import json
import time
import random
from datetime import datetime, timedelta
from typing import Any, Optional
from urllib.parse import urlparse

from django.core.management.base import BaseCommand, CommandError

import requests

from posthog.models import Team


class Command(BaseCommand):
    help = "Generate synthetic events for development and testing via /e endpoint"

    def add_arguments(self, parser):
        parser.add_argument(
            "--team-id",
            type=int,
            help="Team ID (project ID). If provided, API key will be looked up from the team",
        )
        parser.add_argument(
            "--api-key",
            type=str,
            help="API key (team token). Overrides --team-id lookup",
        )
        parser.add_argument(
            "--event",
            type=str,
            default="$pageview",
            help="Event name (default: $pageview)",
        )
        parser.add_argument(
            "--count",
            type=int,
            default=500,
            help="Number of events to send (default: 500)",
        )
        parser.add_argument(
            "--prefix",
            type=str,
            default="seed",
            help="Distinct ID prefix (default: seed)",
        )
        parser.add_argument(
            "--interval",
            type=int,
            default=0,
            help="Inter-event sleep in milliseconds (default: 0)",
        )
        parser.add_argument(
            "--today",
            action="store_true",
            help="Force timestamps to today UTC (default behavior)",
        )
        parser.add_argument(
            "--days",
            type=int,
            default=0,
            help="Backdate over N days (uniform spread). Overrides --today",
        )
        parser.add_argument(
            "--jitter-ms",
            type=int,
            default=0,
            help="Randomize +/- M milliseconds per event (default: 0)",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Don't actually send events, just print what would be sent",
        )
        parser.add_argument(
            "--endpoint",
            type=str,
            default="http://localhost:8010/e/",
            help="PostHog capture endpoint (default: http://localhost:8010/e/)",
        )
        parser.add_argument(
            "--realistic",
            action="store_true",
            help="Generate realistic properties for standard events (e.g., $pageview gets $current_url, $browser, etc.)",
        )

    def handle(self, *args, **options):
        # Validate arguments
        if not options["api_key"] and not options["team_id"]:
            raise CommandError("Provide --api-key or --team-id")

        # Resolve API key from team ID if needed
        api_key = options["api_key"]
        if not api_key:
            try:
                team = Team.objects.get(id=options["team_id"])
                api_key = team.api_token
                self.stdout.write(f"Using API key from team {options['team_id']}: {api_key[:12]}...")
            except Team.DoesNotExist:
                raise CommandError(f"Team with ID {options['team_id']} not found")

        # Set up parameters
        event = options["event"]
        count = options["count"]
        prefix = options["prefix"]
        interval_ms = options["interval"]
        spread_days = options["days"]
        jitter_ms = options["jitter_ms"]
        dry_run = options["dry_run"]
        endpoint = options["endpoint"]

        # Override spread_days if --today is explicitly set
        if options["today"] and spread_days == 0:
            spread_days = 0

        self.stdout.write(
            f"Using api_key={api_key[:12]}... event={event} count={count} "
            f"prefix={prefix} spread_days={spread_days} interval_ms={interval_ms} "
            f"jitter_ms={jitter_ms} dry_run={dry_run}"
        )

        if dry_run:
            self.stdout.write("DRY RUN MODE - No events will be sent")

        # Generate and send events
        start_ts_epoch_ms = int(datetime.utcnow().timestamp() * 1000)
        sent_count = 0

        for i in range(1, count + 1):
            # Compute timestamp
            if spread_days > 0:
                # Uniformly spread over past N days
                offset_days = random.randint(0, spread_days)
                # Spread across day: random seconds in day
                offset_secs = random.randint(0, 86399)
                ts = datetime.utcnow() - timedelta(days=offset_days, seconds=86399 - offset_secs)
                ts_iso = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"
            else:
                # Today, optionally jittered around now
                jitter = 0
                if jitter_ms > 0:
                    jitter = random.randint(-jitter_ms, jitter_ms)
                ts_epoch_ms = start_ts_epoch_ms + jitter
                ts = datetime.fromtimestamp(ts_epoch_ms / 1000)
                ts_iso = ts.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

            # Create event payload
            distinct_id = f"{prefix}-{i}"
            payload = {
                "api_key": api_key,
                "event": event,
                "distinct_id": distinct_id,
                "timestamp": ts_iso,
            }

            # Add realistic properties if requested
            if options["realistic"]:
                properties = self._generate_realistic_properties(event, i)
                if properties:
                    payload["properties"] = properties

            if dry_run:
                self.stdout.write(f"Would send: {json.dumps(payload)}")
            else:
                try:
                    response = requests.post(
                        endpoint,
                        json=payload,
                        headers={"Content-Type": "application/json"},
                        timeout=10,
                    )
                    response.raise_for_status()
                    sent_count += 1
                except requests.RequestException as e:
                    self.stderr.write(f"Failed to send event {i}: {e}")
                    continue

            # Sleep between events if specified
            if interval_ms > 0:
                time.sleep(interval_ms / 1000.0)

        if dry_run:
            self.stdout.write(f"Dry run complete: would have sent {count} events")
        else:
            self.stdout.write(f"Done: sent {sent_count}/{count} events for event={event}")

    def _rand_between(self, min_val: int, max_val: int) -> int:
        """Generate random integer between min and max (inclusive)."""
        return random.randint(min_val, max_val)

    def _generate_realistic_properties(self, event: str, event_index: int) -> Optional[dict[str, Any]]:
        """Generate realistic properties for standard PostHog events."""
        if event == "$pageview":
            return self._generate_pageview_properties(event_index)
        elif event == "$autocapture":
            return self._generate_autocapture_properties(event_index)
        elif event == "$identify":
            return self._generate_identify_properties(event_index)
        # For custom events, return None to keep them minimal
        return None

    def _generate_pageview_properties(self, event_index: int) -> dict[str, Any]:
        """Generate realistic properties for $pageview events."""
        # Sample URLs and pages
        pages = [
            "https://example.com/",
            "https://example.com/about",
            "https://example.com/products",
            "https://example.com/contact",
            "https://example.com/blog",
            "https://example.com/pricing",
            "https://example.com/docs",
            "https://example.com/support",
        ]

        browsers = ["Chrome", "Firefox", "Safari", "Edge"]
        operating_systems = ["Windows", "macOS", "Linux", "iOS", "Android"]
        device_types = ["Desktop", "Mobile", "Tablet"]

        # Sample referrers
        referrers = [
            "https://google.com/search?q=example",
            "https://github.com/example/repo",
            "https://stackoverflow.com/questions/123456",
            "https://example.com/",
            "$direct",
        ]

        current_url = random.choice(pages)
        parsed_url = urlparse(current_url)

        properties = {
            "$current_url": current_url,
            "$host": parsed_url.netloc,
            "$pathname": parsed_url.path,
            "$browser": random.choice(browsers),
            "$os": random.choice(operating_systems),
            "$device_type": random.choice(device_types),
            "$session_id": f"session_{random.randint(1000, 9999)}",
            "title": f"Page {event_index} - Example Site",
        }

        # Add referrer sometimes
        if random.random() < 0.7:  # 70% chance of having a referrer
            referrer = random.choice(referrers)
            properties["$referrer"] = referrer
            if referrer != "$direct":
                properties["$referring_domain"] = urlparse(referrer).netloc

        # Add some UTM parameters sometimes
        if random.random() < 0.3:  # 30% chance of UTM params
            utm_sources = ["google", "facebook", "twitter", "linkedin", "email"]
            utm_mediums = ["cpc", "social", "email", "organic"]
            utm_campaigns = ["summer_sale", "product_launch", "newsletter", "retargeting"]

            properties["utm_source"] = random.choice(utm_sources)
            properties["utm_medium"] = random.choice(utm_mediums)
            properties["utm_campaign"] = random.choice(utm_campaigns)

        return properties

    def _generate_autocapture_properties(self, event_index: int) -> dict[str, Any]:
        """Generate realistic properties for $autocapture events."""
        return {
            "$event_type": "click",
            "$elements": [
                {
                    "tag_name": "button",
                    "text": f"Click me {event_index}",
                    "attr__class": "btn btn-primary",
                }
            ],
        }

    def _generate_identify_properties(self, event_index: int) -> dict[str, Any]:
        """Generate realistic properties for $identify events."""
        return {
            "$set": {
                "email": f"user{event_index}@example.com",
                "name": f"User {event_index}",
            }
        }
