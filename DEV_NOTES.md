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

Kafka loopback inside ClickHouse (avoid table edits)
- Problem: Some Kafka ENGINE tables are hardcoded to `localhost:9092` and ClickHouse runs in a container where the broker is `kafka:9092`.
- Solution: Start a loopback proxy inside the ClickHouse network namespace so `localhost:9092` forwards to `kafka:9092`.

overlay file: `docker-compose.dev.local.yml`
```
services:
    kafka:
        ports:
            - 19092:19092
    # Network overlay: expose a loopback Kafka inside the ClickHouse container namespace
    clickhouse-kafka-loopback:
        image: alpine:3.19
        command: >-
            sh -c "apk add --no-cache socat && \
            socat -d -d TCP-LISTEN:9092,fork,reuseaddr TCP:kafka:9092"
        network_mode: "service:clickhouse"
        depends_on:
            - clickhouse
            - kafka
```

How to apply:
- `bin/start` already auto-includes the local overlay; or run:
```
docker compose -f docker-compose.dev.yml -f docker-compose.dev.local.yml up -d clickhouse-kafka-loopback
```
- Verify inside ClickHouse container:
```
docker exec -t posthog-clickhouse-1 sh -lc 'nc -w 2 localhost 9092 < /dev/null >/dev/null 2>&1; echo $?'
# Expect 0
```

Why this helps:
- Existing Kafka ENGINE tables that point to `localhost:9092` work without recreating them.
- Keeps local dev repeatable with minimal diffs.

If you don't see demo data in the UI
- Sometimes demo data lands in a different project than the one you're viewing.
- Find the project (team_id) that has data and switch to it (e.g. `/project/18`).

Quick checks
```
# 1) Which teams have data recently?
docker exec -t posthog-clickhouse-1 clickhouse-client -q \
  "SELECT team_id, count() AS c FROM default.events \
   WHERE timestamp > now() - INTERVAL 2 HOUR \
   GROUP BY team_id ORDER BY c DESC LIMIT 10 FORMAT Pretty"

# 2) Map ids to names (optional)
python manage.py shell -c "from posthog.models import Team; \
import json; \
print(json.dumps({t.id: t.name for t in Team.objects.filter(id__in=[2,18,19])}))"

# 3) Ensure your user has access to that org (example: team_id=18)
python manage.py shell -c "from posthog.models import Team, OrganizationMembership, User; \
u=User.objects.get(email='test@posthog.com'); \
org=Team.objects.get(id=18).organization; \
OrganizationMembership.objects.get_or_create(organization=org, user=u, \
    defaults={'level': OrganizationMembership.Level.MEMBER}); print('ok')"

# 4) In the browser, switch to that project: http://localhost:8010/project/18
```

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

Alert emails via Maildev (local SMTP)
- Maildev runs in dev: SMTP `127.0.0.1:1025`, UI `http://localhost:1080`.
- Two ways to enable emails locally:
  - Env vars in `.env` (loaded by bin/start):
    ```
    EMAIL_HOST=127.0.0.1
    EMAIL_PORT=1025
    EMAIL_ENABLED=true
    EMAIL_USE_TLS=false
    EMAIL_USE_SSL=false
    EMAIL_HOST_USER=
    EMAIL_HOST_PASSWORD=
    ```
  - Or dynamic instance settings (no restart needed):
    ```bash
    flox activate -- bash -lc "python manage.py shell -c \"from posthog.models.instance_setting import set_instance_setting as s; s('EMAIL_HOST','127.0.0.1'); s('EMAIL_PORT',1025); s('EMAIL_ENABLED', True); s('EMAIL_USE_TLS', False); s('EMAIL_USE_SSL', False); s('EMAIL_HOST_USER',''); s('EMAIL_HOST_PASSWORD',''); print('email on')\""
    ```

Quick alert test
```bash
# subscribe your user to an alert
flox activate -- bash -lc "python manage.py shell -c \"from posthog.models import AlertConfiguration, User; a=AlertConfiguration.objects.get(id='REPLACE_ALERT_ID'); u=User.objects.get(email='test@posthog.com'); a.subscribed_users.add(u); a.save(); print('subscribed')\""

# (optional) evaluate ongoing interval (today)
flox activate -- bash -lc "python manage.py shell -c \"from posthog.models import AlertConfiguration; a=AlertConfiguration.objects.get(id='REPLACE_ALERT_ID'); cfg=a.config or {}; cfg['check_ongoing_interval']=True; a.config=cfg; a.next_check_at=None; a.save(); print('cfg set')\""

# seed events to breach threshold (example: team 18)
bin/seed-events -t 18 -n 800 --today

# force-run the check
flox activate -- bash -lc "python manage.py shell -c \"from posthog.tasks.alerts.checks import check_alert; check_alert('REPLACE_ALERT_ID'); print('done')\""

# inspect last checks (should show FIRING and targets_notified)
flox activate -- bash -lc "python manage.py shell -c \"from posthog.models.alert import AlertCheck, AlertConfiguration; a=AlertConfiguration.objects.get(id='REPLACE_ALERT_ID'); c=AlertCheck.objects.filter(alert_configuration=a).order_by('-created_at').first(); print(c.state, c.calculated_value, c.targets_notified)\""

# open Maildev UI
# http://localhost:1080
```


