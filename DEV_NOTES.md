## Dev notes for local PostHog (flox + Redpanda + ClickHouse)

Context: Redpanda exposes two listeners by default in our compose:
- Internal (containers): `kafka:9092`
- External (host): `localhost:19092`

Rules we follow:
- Django/services on the host connect to `localhost:19092`.
- ClickHouse Kafka engine tables must point to `kafka:9092`.

What we added:
- `docker-compose.dev.local.yml` exposing 19092 on the host.
- `bin/mprocs.yaml` now auto-includes the local overlay if present.

Suggested local `.env` (do not commit):
```
KAFKA_HOSTS=localhost:19092
KAFKA_URL_FOR_CLICKHOUSE=kafka:9092
```

Common symptom/fix:
- Symptom: generate_demo_data times out waiting for persons to land in ClickHouse.
- Cause: ClickHouse Kafka ENGINE tables pointed at `localhost:9092` inside the container.
- Fix: ensure ClickHouse Kafka ENGINE tables use `kafka:9092`, then re-run:
  - `python manage.py migrate_clickhouse`
  - `python manage.py generate_demo_data`


