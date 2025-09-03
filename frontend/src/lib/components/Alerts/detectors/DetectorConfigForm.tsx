import { LemonInput, LemonSelect, Tooltip } from '@posthog/lemon-ui'

import { LemonField } from 'lib/lemon-ui/LemonField'

type Props = {
    type: string
    config: Record<string, any>
    onChange: (patch: Record<string, any>) => void

    seriesIndex?: number | string
    onSeriesChange?: (index: number | string) => void
    seriesOptions?: Array<{ label: string; value: number | string }>
}

export function DetectorConfigForm({
    type,
    config,
    onChange,
    seriesIndex,
    onSeriesChange,
    seriesOptions,
}: Props): JSX.Element | null {
    if (type === 'zscore') {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-24 text-muted-alt">What</div>
                    <div>
                        <LemonSelect
                            className="w-64"
                            value={seriesIndex ?? 0}
                            onChange={(val) => onSeriesChange?.(val)}
                            options={seriesOptions ?? []}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Window</div>
                        <LemonField name="window">
                            <Tooltip
                                title="Number of past periods to analyze for establishing 'normal' behavior. More periods = more stable baseline but slower to adapt to trends. Recommended: 30 for daily data, 7-14 for hourly data."
                                placement="right"
                            >
                                <LemonInput
                                    type="number"
                                    className="w-28"
                                    placeholder="30"
                                    value={config.window ?? 30}
                                    onChange={(v) => onChange({ window: Number(v) })}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Measure</div>
                        <LemonField name="on">
                            <Tooltip
                                title="What to monitor: 'Value' checks the actual metric value, 'Delta' checks the change from the previous period. Use 'Delta' to catch sudden spikes/drops, 'Value' for absolute thresholds."
                                placement="right"
                            >
                                <LemonSelect
                                    className="w-32"
                                    value={config.on ?? 'value'}
                                    onChange={(val) => onChange({ on: val })}
                                    options={[
                                        {
                                            label: 'Value',
                                            value: 'value',
                                            tooltip:
                                                'Monitor the actual metric value - good for detecting when metrics exceed absolute thresholds',
                                        },
                                        {
                                            label: 'Delta',
                                            value: 'delta',
                                            tooltip:
                                                'Monitor the change from previous period - good for detecting sudden spikes or drops regardless of absolute value',
                                        },
                                    ]}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Z threshold</div>
                        <LemonField name="z_threshold">
                            <Tooltip
                                title="How many standard deviations from normal to trigger an alert. Lower = more sensitive. Typical values: 2 (frequent alerts), 3 (balanced), 4+ (rare alerts only)."
                                placement="right"
                            >
                                <LemonInput
                                    type="number"
                                    step={0.1}
                                    className="w-28"
                                    placeholder="3.0"
                                    value={config.z_threshold ?? 3}
                                    onChange={(v) => onChange({ z_threshold: Number(v) })}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Direction</div>
                        <LemonField name="direction">
                            <Tooltip
                                title="Which direction to monitor: 'Up' for increases only, 'Down' for decreases only, 'Both' for any unusual change in either direction."
                                placement="right"
                            >
                                <LemonSelect
                                    className="w-32"
                                    value={config.direction ?? 'both'}
                                    onChange={(val) => onChange({ direction: val })}
                                    options={[
                                        {
                                            label: 'Both',
                                            value: 'both',
                                            tooltip:
                                                'Alert on unusual changes in either direction - most comprehensive monitoring',
                                        },
                                        {
                                            label: 'Up',
                                            value: 'up',
                                            tooltip:
                                                'Alert only on unusual increases - good for monitoring growth metrics',
                                        },
                                        {
                                            label: 'Down',
                                            value: 'down',
                                            tooltip:
                                                'Alert only on unusual decreases - good for monitoring performance/quality metrics',
                                        },
                                    ]}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>
                </div>
            </div>
        )
    }

    if (type === 'mad') {
        return (
            <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-24 text-muted-alt">What</div>
                    <LemonField name="series_index">
                        <div>
                            <LemonSelect
                                className="w-64"
                                value={seriesIndex ?? 0}
                                onChange={(val) => onSeriesChange?.(val)}
                                options={seriesOptions ?? []}
                            />
                        </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Window</div>
                        <LemonField name="window">
                            <Tooltip
                                title="Number of past periods to analyze for establishing 'normal' behavior. More periods = more stable baseline but slower to adapt to trends. Recommended: 30 for daily data, 7-14 for hourly data."
                                placement="right"
                            >
                                <LemonInput
                                    type="number"
                                    className="w-28"
                                    placeholder="30"
                                    value={config.window ?? 30}
                                    onChange={(v) => onChange({ window: Number(v) })}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Measure</div>
                        <LemonField name="on">
                            <Tooltip
                                title="What to monitor: 'Value' checks the actual metric value, 'Delta' checks the change from the previous period. Use 'Delta' to catch sudden spikes/drops, 'Value' for absolute thresholds."
                                placement="right"
                            >
                                <LemonSelect
                                    className="w-32"
                                    value={config.on ?? 'value'}
                                    onChange={(val) => onChange({ on: val })}
                                    options={[
                                        {
                                            label: 'Value',
                                            value: 'value',
                                            tooltip:
                                                'Monitor the actual metric value - good for detecting when metrics exceed absolute thresholds',
                                        },
                                        {
                                            label: 'Delta',
                                            value: 'delta',
                                            tooltip:
                                                'Monitor the change from previous period - good for detecting sudden spikes or drops regardless of absolute value',
                                        },
                                    ]}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">k threshold</div>
                        <LemonField name="k">
                            <Tooltip
                                title="How extreme a value must be to trigger an alert. Lower = more sensitive. Typical values: 2.5 (frequent alerts), 3.5 (balanced), 5+ (rare alerts only). MAD is less sensitive to outliers than Z-score."
                                placement="right"
                            >
                                <LemonInput
                                    type="number"
                                    step={0.1}
                                    className="w-28"
                                    placeholder="3.5"
                                    value={config.k ?? 3.5}
                                    onChange={(v) => onChange({ k: Number(v) })}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="w-24 text-muted-alt">Direction</div>
                        <LemonField name="direction">
                            <Tooltip
                                title="Which direction to monitor: 'Up' for increases only, 'Down' for decreases only, 'Both' for any unusual change in either direction."
                                placement="right"
                            >
                                <LemonSelect
                                    className="w-32"
                                    value={config.direction ?? 'both'}
                                    onChange={(val) => onChange({ direction: val })}
                                    options={[
                                        {
                                            label: 'Both',
                                            value: 'both',
                                            tooltip:
                                                'Alert on unusual changes in either direction - most comprehensive monitoring',
                                        },
                                        {
                                            label: 'Up',
                                            value: 'up',
                                            tooltip:
                                                'Alert only on unusual increases - good for monitoring growth metrics',
                                        },
                                        {
                                            label: 'Down',
                                            value: 'down',
                                            tooltip:
                                                'Alert only on unusual decreases - good for monitoring performance/quality metrics',
                                        },
                                    ]}
                                />
                            </Tooltip>
                        </LemonField>
                    </div>
                </div>
            </div>
        )
    }

    return null
}
