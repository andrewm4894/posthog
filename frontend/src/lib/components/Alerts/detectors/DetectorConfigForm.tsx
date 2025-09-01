import { LemonInput, LemonSelect, Tooltip } from '@posthog/lemon-ui'

import { LemonField } from 'lib/lemon-ui/LemonField'

type Props = {
    type: string
    config: Record<string, any>
    onChange: (patch: Record<string, any>) => void
}

export function DetectorConfigForm({ type, config, onChange }: Props): JSX.Element | null {
    if (type === 'zscore') {
        return (
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-32 text-muted-alt">Window</div>
                    <LemonField name="window">
                        <Tooltip
                            title="Past intervals used to compute baseline mean and std (default 30)."
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
                    <div className="w-32 text-muted-alt">Measure</div>
                    <LemonField name="on">
                        <Tooltip title="What to evaluate: raw value or change vs previous (delta)." placement="right">
                            <LemonSelect
                                className="w-40"
                                value={config.on ?? 'value'}
                                onChange={(val) => onChange({ on: val })}
                                options={[
                                    { label: 'value', value: 'value' },
                                    { label: 'delta', value: 'delta' },
                                ]}
                            />
                        </Tooltip>
                    </LemonField>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-32 text-muted-alt">Z threshold</div>
                    <LemonField name="z_threshold">
                        <Tooltip
                            title="Trigger when z-score meets or exceeds this value (default 3)."
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
                    <div className="w-32 text-muted-alt">Direction</div>
                    <LemonField name="direction">
                        <Tooltip title="Alert on spikes up, down, or both (two-tailed)." placement="right">
                            <LemonSelect
                                className="w-40"
                                value={config.direction ?? 'both'}
                                onChange={(val) => onChange({ direction: val })}
                                options={[
                                    { label: 'Both', value: 'both' },
                                    { label: 'Up', value: 'up' },
                                    { label: 'Down', value: 'down' },
                                ]}
                            />
                        </Tooltip>
                    </LemonField>
                </div>
            </div>
        )
    }

    if (type === 'mad') {
        return (
            <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-32 text-muted-alt">Window</div>
                    <LemonField name="window">
                        <Tooltip title="Past intervals used to compute median and MAD (default 30)." placement="right">
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
                    <div className="w-32 text-muted-alt">Measure</div>
                    <LemonField name="on">
                        <Tooltip title="What to evaluate: raw value or change vs previous (delta)." placement="right">
                            <LemonSelect
                                className="w-40"
                                value={config.on ?? 'value'}
                                onChange={(val) => onChange({ on: val })}
                                options={[
                                    { label: 'value', value: 'value' },
                                    { label: 'delta', value: 'delta' },
                                ]}
                            />
                        </Tooltip>
                    </LemonField>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="w-32 text-muted-alt">k threshold</div>
                    <LemonField name="k">
                        <Tooltip
                            title="Trigger when |robust score| (MAD) meets or exceeds k (default 3.5)."
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
                    <div className="w-32 text-muted-alt">Direction</div>
                    <LemonField name="direction">
                        <Tooltip title="Alert on spikes up, down, or both (two-sided)." placement="right">
                            <LemonSelect
                                className="w-40"
                                value={config.direction ?? 'both'}
                                onChange={(val) => onChange({ direction: val })}
                                options={[
                                    { label: 'Both', value: 'both' },
                                    { label: 'Up', value: 'up' },
                                    { label: 'Down', value: 'down' },
                                ]}
                            />
                        </Tooltip>
                    </LemonField>
                </div>
            </div>
        )
    }

    return null
}
