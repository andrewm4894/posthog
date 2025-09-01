## Alerts v2 – generalized detectors and evaluations

Goal: Evolve alerts from simple thresholds on Trends to a pluggable detector framework (e.g. z-score, MAD, relative change, seasonal baselines, ML-based).

Scope (initial cut):
- Keep insights (TrendsQuery) as the value source.
- Add a detector abstraction and config model.
- Ship two detectors:
  - Z-score detector (optionally on value, delta, or pct-delta)
  - MAD detector (robust outlier detection)
- Preserve existing absolute/relative threshold alerts for backwards compatibility.

### Current state (TL;DR)
- `AlertConfiguration` binds to an `Insight` (TrendsQuery) and stores:
  - `condition` (absolute/relative)
  - `threshold` (InsightThreshold with bounds)
  - `config` (TrendsAlertConfig: series_index, check_ongoing_interval)
- Evaluation flow:
  - `check_alerts_task` → `check_alert_task` → `check_alert_for_insight`
  - For Trends: `check_trends_alert` computes time series, selects current/previous interval, compares against bounds, updates `AlertCheck`, and sends notifications.

### Design: generalized detectors

Key ideas:
- Introduce `DetectorType` and `DetectorConfig` (pydantic) with a uniform evaluation contract.
- Detector evaluates a sequence (N intervals from Trends) and returns:
  - `value` (scalar relevant to the alert; e.g. z-score or raw value)
  - `breaches` (list[str] messages)
  - Optional metadata (e.g. baseline mean/std, window size)

#### Detector registry
- Python module `posthog/tasks/alerts/detectors/` with:
  - `base.py`: `Detector`, `DetectorConfig` protocols
  - `zscore.py`, `mad.py` implementing `evaluate(series: list[float], context) -> AlertEvaluationResult`
- Registry map: `DETECTORS = { 'zscore': ZScoreDetector, 'mad': MadDetector }`
- Config union in schema: `AlertDetectorConfig = ZScoreConfig | MADConfig | ...`

#### Config schema (examples)
- ZScoreConfig
  - fields: `window:int` (>= N), `on: 'value'|'delta'|'pct_delta'`, `z_threshold: float`, `min_points:int=10`, `two_tailed:bool=True`
- MADConfig
  - fields: `window:int`, `on: 'value'|'delta'|'pct_delta'`, `k: float` (scale factor; typical 3.5), `min_points:int=10`

#### Math
- Pre-process series according to `on`:
  - value: `x_t`
  - delta: `x_t - x_{t-1}`
  - pct_delta: `(x_t - x_{t-1}) / max(eps, x_{t-1})`
- Z-score: compute `μ`, `σ` on window `W` (exclude t when using ongoing interval), `z = (x_t - μ) / (σ+eps)`. Breach if `|z| >= z_threshold` (two-tailed) or `z >= z_threshold` (one-tailed).
- MAD: median `m`, `mad = median(|x - m|)`; robust score `r = 0.6745 * (x_t - m) / (mad+eps)`; breach if `|r| >= k`.

### Backend changes

- Schema (pydantic / DB):
  - Add `detector_config` (JSON) to `AlertConfiguration.config` OR add `detector` top-level field.
  - Back-compat: if `threshold` present → use existing threshold path; else if `detector_config` present → use detector path.
- Evaluation:
  - In `check_trends_alert`, build a windowed series with `filters_override = _date_range_override_for_intervals(query, last_x_intervals=W_needed)` and always return raw timeseries (not just current/prev).
  - Route to detector if `detector_config` present.
  - Detector returns `value` (could be z or robust score) and `breaches` → same `AlertEvaluationResult`.
- Notifications: unchanged. Include detector metadata in `AlertCheck.condition` payload for debugging.

### API/UI changes

- UI Alert editor:
  - Mode switch: Threshold | Detector
  - Detector picker: Z-score, MAD (later ML)
  - Config inputs (window, on=value/delta/pct-delta, thresholds)
  - Validation and live preview (run quick query for last N intervals and show computed score + breach state for current interval)
  - Keep existing workflow for threshold alerts.
- API:
  - Extend alert create/update to accept `detector_config` object. Validate via pydantic.
  - For previews: new endpoint `POST /api/alerts/preview` that accepts insight + detector config, returns series, score, breach decision.

### Execution flow (end-to-end)
1. User creates alert → selects insight → chooses Detector (e.g. Z-score) → sets params → subscribes.
2. Scheduler picks due alerts.
3. For each alert:
   - Compute timeseries for W+1 intervals.
   - Run detector; build `AlertCheck` with `value`, `breaches`.
   - If breached, send notifications.
4. Store metadata in `AlertCheck.condition` (e.g. `{detector:'zscore', window:W, on:'delta', threshold:3.0, stats:{mean, std}}`).

### Testing plan
- Unit tests for detectors (toy series; edge cases: zero variance, short window, NaNs).
- Integration tests for alert checks with seeded data; ensure notifications fire and `AlertCheck` captured.
- API tests for create/update/preview validation.

### Rollout / migration
- Non-breaking: existing alerts keep working.
- Feature flagged `ALERTS_DETECTORS_ENABLED` to gate UI and API.
- Migrations: none required if we re-use `AlertConfiguration.config` JSON for detector config; otherwise add a nullable `detector_config` column.

### Risks and mitigations
- Performance: Z-score/MAD require a window of points; bound W (e.g. max 1000) and use RECENT_CACHE_CALCULATE.
- Data sparsity: enforce `min_points`; degrade to NOT_FIRING with hint.
- Seasonality: out of scope initially; later add day-of-week baselines or STL decomposition.
- False positives: expose two-tailed choice and smoothing options (EMA). Start conservative defaults.

### Minimal implementation steps
1. Schema: Add detector config union to pydantic schema (backend only).
2. Backend: `detectors/` with zscore + mad; registry; route from `check_trends_alert`.
3. API: accept `detector_config`; add preview endpoint.
4. UI: experimental form for detector mode (behind flag), basic inputs and preview.
5. Docs: DEV_NOTES additions and examples.

### Example detector config payloads
```json
{
  "type": "ZScoreConfig",
  "window": 30,
  "on": "delta",
  "z_threshold": 3.0,
  "two_tailed": true,
  "min_points": 10
}
```

```json
{
  "type": "MADConfig",
  "window": 30,
  "on": "pct_delta",
  "k": 3.5,
  "min_points": 10
}
```


