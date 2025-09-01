from posthog.tasks.alerts.detectors.base import DetectorContext
from posthog.tasks.alerts.detectors.mad import MADConfig, MADDetectorImpl
from posthog.tasks.alerts.detectors.threshold import ThresholdBounds, ThresholdConfig, ThresholdDetectorImpl
from posthog.tasks.alerts.detectors.zscore import ZScoreConfig, ZScoreDetectorImpl


def test_zscore_value_two_tailed_fires():
    # baseline ~0, current = 10 with std=~2 => z ~= 5
    series = [0, 1, -1, 2, -2, 1, -1, 10]
    ctx = DetectorContext(series=series)
    cfg = ZScoreConfig(window=6, on="value", z_threshold=3.0, direction="both", min_points=2)
    res = ZScoreDetectorImpl().evaluate(ctx, cfg)
    assert res.value is not None and abs(res.value) >= 3
    assert res.breaches and any("Z-score alert:" in b for b in res.breaches)


def test_zscore_value_up_only():
    series = [0, 0, 0, 0, 5]
    ctx = DetectorContext(series=series)
    cfg = ZScoreConfig(window=3, on="value", z_threshold=2.0, direction="up", min_points=2)
    res = ZScoreDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches, "Should breach on upwards spike"


def test_zscore_value_down_only():
    series = [10, 10, 10, 2]
    ctx = DetectorContext(series=series)
    cfg = ZScoreConfig(window=3, on="value", z_threshold=2.0, direction="down", min_points=2)
    res = ZScoreDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches, "Should breach on downwards drop"


def test_zscore_delta():
    # deltas: [1,1,1,6] -> last delta 6 vs baseline ~1 => high z
    series = [1, 2, 3, 4, 10]
    ctx = DetectorContext(series=series)
    cfg = ZScoreConfig(window=3, on="delta", z_threshold=2.5, direction="both", min_points=2)
    res = ZScoreDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches


def test_zscore_not_enough_points():
    series = [1]
    ctx = DetectorContext(series=series)
    cfg = ZScoreConfig(window=30, on="value", z_threshold=3.0, direction="both", min_points=10)
    res = ZScoreDetectorImpl().evaluate(ctx, cfg)
    assert res.value is None and not res.breaches


def test_threshold_value_upper():
    series = [1, 2, 3, 4]
    ctx = DetectorContext(series=series)
    cfg = ThresholdConfig(on="value", bounds=ThresholdBounds(lower=None, upper=3))
    res = ThresholdDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches and any("upper" in b for b in res.breaches)


def test_threshold_value_lower():
    series = [10, 9, 8, 1]
    ctx = DetectorContext(series=series)
    cfg = ThresholdConfig(on="value", bounds=ThresholdBounds(lower=5, upper=None))
    res = ThresholdDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches and any("lower" in b for b in res.breaches)


def test_threshold_delta():
    series = [1, 2, 3, 100]
    # deltas: [1,1,97] last=97 > 50
    ctx = DetectorContext(series=series)
    cfg = ThresholdConfig(on="delta", bounds=ThresholdBounds(lower=None, upper=50))
    res = ThresholdDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches


def test_mad_value_two_sided():
    series = [0, 1, -1, 2, -2, 1, -1, 10]
    ctx = DetectorContext(series=series)
    cfg = MADConfig(window=6, on="value", k=3.0, direction="both", min_points=2)
    res = MADDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches


def test_mad_up_only():
    series = [0, 0, 0, 5]
    ctx = DetectorContext(series=series)
    cfg = MADConfig(window=3, on="value", k=2.5, direction="up", min_points=2)
    res = MADDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches


def test_mad_down_only():
    series = [10, 10, 10, 1]
    ctx = DetectorContext(series=series)
    cfg = MADConfig(window=3, on="value", k=2.5, direction="down", min_points=2)
    res = MADDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches


def test_mad_delta():
    series = [1, 2, 3, 10]
    ctx = DetectorContext(series=series)
    cfg = MADConfig(window=3, on="delta", k=2.5, direction="both", min_points=2)
    res = MADDetectorImpl().evaluate(ctx, cfg)
    assert res.breaches
