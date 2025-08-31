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

Troubleshooting person distinct IDs
- Symptom: Persons land but Person Distinct IDs stall (e.g. stuck at 0/N).
- Verify consumers inside ClickHouse:
```
docker exec -t posthog-clickhouse-1 clickhouse-client -q "SELECT database, table, num_messages_read, assignments.topic, assignments.current_offset FROM system.kafka_consumers WHERE database='default' AND table IN ('kafka_person','kafka_person_distinct_id','kafka_person_distinct_id2') FORMAT Pretty"
```
- If `kafka_person_distinct_id2` has no assignments or zero reads, recreate it to point to `kafka:9092` and give it its own consumer group so it can read existing topic data:
```
docker exec -i posthog-clickhouse-1 clickhouse-client <<'SQL'
DROP TABLE IF EXISTS default.kafka_person_distinct_id2;
CREATE TABLE default.kafka_person_distinct_id2 (
    team_id Int64,
    distinct_id String,
    person_id UUID,
    is_deleted Int8,
    version Int64
) ENGINE = Kafka('kafka:9092', 'clickhouse_person_distinct_id', 'clickhouse-person-distinct-id2', 'JSONEachRow');
SQL
```
- Re-run the generator and then verify row counts:
```
docker exec -t posthog-clickhouse-1 clickhouse-client -q "SELECT count() FROM default.person; SELECT count() FROM default.person_distinct_id; SELECT count() FROM default.person_distinct_id2;"
```


