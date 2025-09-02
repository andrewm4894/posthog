import { useActions, useValues } from 'kea'
import { Form, Group } from 'kea-forms'
import { useCallback } from 'react'
import { useEffect, useState } from 'react'

import { IconInfo } from '@posthog/icons'
import {
    LemonBanner,
    LemonCheckbox,
    LemonCollapse,
    LemonInput,
    LemonSegmentedButton,
    LemonSelect,
    SpinnerOverlay,
    Tooltip,
} from '@posthog/lemon-ui'

import api from 'lib/api'
import { AlertStateIndicator } from 'lib/components/Alerts/views/ManageAlertsModal'
import { MemberSelectMultiple } from 'lib/components/MemberSelectMultiple'
import { TZLabel } from 'lib/components/TZLabel'
import { UserActivityIndicator } from 'lib/components/UserActivityIndicator/UserActivityIndicator'
import { dayjs } from 'lib/dayjs'
import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonField } from 'lib/lemon-ui/LemonField'
import { LemonModal } from 'lib/lemon-ui/LemonModal'
import { IconChevronLeft } from 'lib/lemon-ui/icons'
import { formatDate } from 'lib/utils'
import { insightVizDataLogic } from 'scenes/insights/insightVizDataLogic'
import { trendsDataLogic } from 'scenes/trends/trendsDataLogic'

import {
    AlertCalculationInterval,
    AlertConditionType,
    AlertState,
    InsightThresholdType,
} from '~/queries/schema/schema-general'
import { InsightLogicProps, InsightShortId, QueryBasedInsightModel } from '~/types'

import { SnoozeButton } from '../SnoozeButton'
import { alertFormLogic, canCheckOngoingInterval } from '../alertFormLogic'
import { alertLogic } from '../alertLogic'
import { DetectorConfigForm } from '../detectors/DetectorConfigForm'
import { DetectorPicker } from '../detectors/DetectorPicker'
import { AlertType } from '../types'
import { AlertDestinationSelector } from './AlertDestinationSelector'

function alertCalculationIntervalToLabel(interval: AlertCalculationInterval): string {
    switch (interval) {
        case AlertCalculationInterval.HOURLY:
            return 'hour'
        case AlertCalculationInterval.DAILY:
            return 'day'
        case AlertCalculationInterval.WEEKLY:
            return 'week'
        case AlertCalculationInterval.MONTHLY:
            return 'month'
    }
}

function formatAlertValue(check: any, detectorType?: string): string {
    // For threshold alerts, show the calculated value (which is the raw metric)
    if (!detectorType || detectorType === 'threshold') {
        const value = check.calculated_value
        if (value === null || value === undefined) {
            return ''
        }
        return value.toLocaleString()
    }

    // For Z-score and MAD alerts, show the raw metric value
    const rawValue = check.raw_value
    if (rawValue === null || rawValue === undefined) {
        return ''
    }
    return rawValue.toLocaleString()
}

function formatAlertScore(check: any, detectorType?: string): string {
    const value = check.calculated_value
    if (value === null || value === undefined) {
        return ''
    }

    // Only show detector scores for Z-score and MAD alerts
    if (detectorType === 'zscore') {
        return `${value.toFixed(1)}σ`
    }

    if (detectorType === 'mad') {
        return `${value.toFixed(1)}`
    }

    // For threshold alerts, no separate score column needed
    return ''
}

export function AlertStateTable({ alert }: { alert: AlertType }): JSX.Element | null {
    if (!alert.checks || alert.checks.length === 0) {
        return null
    }

    const detectorType = alert.config?.detector_config?.type
    const showScoreColumn = detectorType === 'zscore' || detectorType === 'mad'

    return (
        <div className="bg-primary p-4 mt-10 rounded-lg">
            <div className="flex flex-row gap-2 items-center mb-2">
                <h3 className="m-0">Current status: </h3>
                <AlertStateIndicator alert={alert} />
                <h3 className="m-0">
                    {alert.snoozed_until && ` until ${formatDate(dayjs(alert?.snoozed_until), 'MMM D, HH:mm')}`}
                </h3>
            </div>
            <table className="w-full table-auto border-spacing-2 border-collapse">
                <thead>
                    <tr className="text-left">
                        <th>Status</th>
                        <th className="text-right">Time</th>
                        <th className="text-right pr-4">Value</th>
                        {showScoreColumn && <th className="text-right pr-4">Score</th>}
                        <th>Targets notified</th>
                    </tr>
                </thead>
                <tbody>
                    {alert.checks.map((check) => (
                        <tr key={check.id}>
                            <td>{check.state}</td>
                            <td className="text-right">
                                <TZLabel time={check.created_at} />
                            </td>
                            <td className="text-right pr-4">{formatAlertValue(check, detectorType)}</td>
                            {showScoreColumn && (
                                <td className="text-right pr-4">{formatAlertScore(check, detectorType)}</td>
                            )}
                            <td>{check.targets_notified ? 'Yes' : 'No'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

interface EditAlertModalProps {
    isOpen: boolean | undefined
    alertId?: AlertType['id']
    insightId: QueryBasedInsightModel['id']
    insightShortId: InsightShortId
    onEditSuccess: (alertId?: AlertType['id'] | undefined) => void
    onClose?: () => void
    insightLogicProps?: InsightLogicProps
}

export function EditAlertModal({
    isOpen,
    alertId,
    insightId,
    insightShortId,
    onClose,
    onEditSuccess,
    insightLogicProps,
}: EditAlertModalProps): JSX.Element {
    const _alertLogic = alertLogic({ alertId })
    const { alert, alertLoading } = useValues(_alertLogic)
    const { loadAlert } = useActions(_alertLogic)

    // need to reload edited alert as well
    const _onEditSuccess = useCallback(
        (alertId: AlertType['id'] | undefined) => {
            if (alertId) {
                loadAlert()
            }
            onEditSuccess(alertId)
        },
        [loadAlert, onEditSuccess]
    )

    const formLogicProps = {
        alert,
        insightId,
        onEditSuccess: _onEditSuccess,
        insightVizDataLogicProps: insightLogicProps,
    }
    const formLogic = alertFormLogic(formLogicProps)
    const { alertForm, isAlertFormSubmitting, alertFormChanged } = useValues(formLogic)
    const { deleteAlert, snoozeAlert, clearSnooze } = useActions(formLogic)
    const { setAlertFormValue } = useActions(formLogic)

    const trendsLogic = trendsDataLogic({ dashboardItemId: insightShortId })
    const vizLogic = insightVizDataLogic({ dashboardItemId: insightShortId })
    const {
        alertSeries,
        alertBreakdownValues,
        isNonTimeSeriesDisplay,
        isBreakdownValid,
        formulaNodes,
        interval: trendInterval,
    } = useValues(trendsLogic)
    const { showAlertThresholdLines } = useValues(vizLogic)
    const { updateInsightFilter } = useActions(vizLogic)

    const creatingNewAlert = alertForm.id === undefined
    // can only check ongoing interval for absolute value/increase alerts with upper threshold
    const can_check_ongoing_interval = canCheckOngoingInterval(alertForm)

    // Alphabet for labeling series (A, B, C, etc.)
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')

    // Instance setting gate for detectors
    const [detectorsEnabled, setDetectorsEnabled] = useState<boolean>(false)
    useEffect(() => {
        void (async () => {
            try {
                const res = await api.get('api/instance_settings')
                const settings = res?.results ?? []
                const isOn = !!settings.find((s: any) => s.key === 'ALERTS_DETECTORS_ENABLED' && s.value)
                setDetectorsEnabled(isOn)
            } catch {
                // Fallback to enable in local dev if the endpoint is restricted
                setDetectorsEnabled(true)
            }
        })()
    }, [])

    // If using a non-threshold detector (e.g., zscore), auto-disable threshold lines on the chart
    useEffect(() => {
        if (alertForm?.config?.detector_config?.type && showAlertThresholdLines) {
            updateInsightFilter({ showAlertThresholdLines: false })
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alertForm?.config?.detector_config?.type])

    // Auto-switch to threshold detector if switching to non-time series insight with zscore/MAD
    useEffect(() => {
        const detectorType = alertForm?.config?.detector_config?.type
        if (isNonTimeSeriesDisplay && (detectorType === 'zscore' || detectorType === 'mad')) {
            setAlertFormValue(['config', 'detector_config'], {})
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isNonTimeSeriesDisplay])

    // Ensure z-score defaults populate the form so selects aren't empty
    useEffect(() => {
        const dc: any = alertForm?.config?.detector_config
        if (dc?.type === 'zscore') {
            const patch: Record<string, any> = {}
            if (dc.on == null) {
                patch.on = 'value'
            }
            if (dc.direction == null && dc.two_tailed == null) {
                patch.direction = 'both'
            }
            if (dc.z_threshold == null) {
                patch.z_threshold = 3.0
            }
            if (dc.window == null) {
                patch.window = 30
            }
            if (Object.keys(patch).length > 0) {
                setAlertFormValue(['config', 'detector_config'], { ...dc, ...patch })
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [alertForm?.config?.detector_config?.type])

    return (
        <LemonModal onClose={onClose} isOpen={isOpen} width={600} simple title="">
            {alertLoading ? (
                <SpinnerOverlay />
            ) : (
                <Form
                    logic={alertFormLogic}
                    props={formLogicProps}
                    formKey="alertForm"
                    enableFormOnSubmit
                    className="LemonModal__layout"
                >
                    <LemonModal.Header>
                        <div className="flex items-center gap-2">
                            <LemonButton icon={<IconChevronLeft />} onClick={onClose} size="xsmall" />

                            <h3>{creatingNewAlert ? 'New' : 'Edit '} Alert</h3>
                        </div>
                    </LemonModal.Header>

                    <LemonModal.Content>
                        <div className="deprecated-space-y-8">
                            <div className="deprecated-space-y-4">
                                <div className="flex gap-4 items-center">
                                    <LemonField className="flex-auto" name="name">
                                        <LemonInput placeholder="Alert name" data-attr="alertForm-name" />
                                    </LemonField>
                                    <LemonField name="enabled">
                                        <LemonCheckbox
                                            checked={alertForm?.enabled}
                                            data-attr="alertForm-enabled"
                                            fullWidth
                                            label="Enabled"
                                        />
                                    </LemonField>
                                </div>
                                {alert?.created_by ? (
                                    <UserActivityIndicator
                                        at={alert.created_at}
                                        by={alert.created_by}
                                        prefix="Created"
                                    />
                                ) : null}
                            </div>

                            <div className="deprecated-space-y-6">
                                <h3>Definition</h3>
                                <div className="deprecated-space-y-5">
                                    {isBreakdownValid && (
                                        <LemonBanner type="warning">
                                            For trends with breakdown, the alert will fire if any of the breakdown
                                            values breaches the threshold.
                                        </LemonBanner>
                                    )}
                                    {detectorsEnabled && (
                                        <div className="flex flex-col gap-2">
                                            <div className="font-semibold">Detector</div>
                                            <Group name={['config', 'detector_config']}>
                                                <DetectorPicker
                                                    value={alertForm?.config?.detector_config?.type ?? ''}
                                                    isTimeSeries={!isNonTimeSeriesDisplay}
                                                    onChange={(type) => {
                                                        setAlertFormValue(['config', 'detector_config'], {
                                                            type,
                                                            ...(type === 'zscore' && {
                                                                window: 30,
                                                                z_threshold: 3.0,
                                                                on: 'value',
                                                                direction: 'both',
                                                            }),
                                                            ...(type === 'mad' && {
                                                                window: 30,
                                                                k: 3.5,
                                                                on: 'value',
                                                                direction: 'both',
                                                            }),
                                                        })
                                                    }}
                                                />
                                                <DetectorConfigForm
                                                    type={alertForm?.config?.detector_config?.type}
                                                    config={alertForm?.config?.detector_config}
                                                    seriesIndex={alertForm?.config?.series_index}
                                                    onSeriesChange={(index) =>
                                                        setAlertFormValue(['config', 'series_index'], index)
                                                    }
                                                    seriesOptions={
                                                        formulaNodes?.length > 0
                                                            ? formulaNodes.map(({ formula, custom_name }, index) => ({
                                                                  label: `${
                                                                      custom_name ? custom_name : 'Formula'
                                                                  } (${formula})`,
                                                                  value: index,
                                                              }))
                                                            : isBreakdownValid
                                                              ? [
                                                                    { label: 'any breakdown value', value: 'any' },
                                                                    {
                                                                        label: 'average of all breakdowns',
                                                                        value: 'average',
                                                                    },
                                                                    ...(alertBreakdownValues || []).map(
                                                                        ({ label, value, seriesIndex }: any) => ({
                                                                            label: `${label} (${value})`,
                                                                            value: seriesIndex,
                                                                        })
                                                                    ),
                                                                ]
                                                              : alertSeries?.map(
                                                                    ({ custom_name, name, event }, index) => ({
                                                                        label: `${alphabet[index]} - ${
                                                                            custom_name ?? name ?? event
                                                                        }`,
                                                                        value: index,
                                                                    })
                                                                )
                                                    }
                                                    onChange={(patch: Record<string, any>) => {
                                                        Object.entries(patch).forEach(([field, value]) =>
                                                            setAlertFormValue(
                                                                ['config', 'detector_config', field],
                                                                value
                                                            )
                                                        )
                                                    }}
                                                />
                                            </Group>
                                        </div>
                                    )}
                                    {!alertForm?.config?.detector_config?.type && (
                                        <div className="flex gap-4 items-center">
                                            <div>When</div>
                                            <Group name={['config']}>
                                                <LemonField name="series_index" className="flex-auto">
                                                    <LemonSelect
                                                        fullWidth
                                                        data-attr="alertForm-series-index"
                                                        options={
                                                            formulaNodes?.length > 0
                                                                ? formulaNodes.map(
                                                                      ({ formula, custom_name }, index) => ({
                                                                          label: `${
                                                                              custom_name ? custom_name : 'Formula'
                                                                          } (${formula})`,
                                                                          value: index,
                                                                      })
                                                                  )
                                                                : alertSeries?.map(
                                                                      ({ custom_name, name, event }, index) => ({
                                                                          label: isBreakdownValid
                                                                              ? 'any breakdown value'
                                                                              : `${alphabet[index]} - ${
                                                                                    custom_name ?? name ?? event
                                                                                }`,
                                                                          value: isBreakdownValid ? 0 : index,
                                                                      })
                                                                  )
                                                        }
                                                        disabledReason={
                                                            isBreakdownValid &&
                                                            `For trends with breakdown, the alert will fire if any of the breakdown
                                                values breaches the threshold.`
                                                        }
                                                    />
                                                </LemonField>
                                            </Group>
                                            <Group name={['condition']}>
                                                <LemonField name="type">
                                                    <LemonSelect
                                                        fullWidth
                                                        className="w-40"
                                                        data-attr="alertForm-condition"
                                                        options={[
                                                            {
                                                                label: 'has value',
                                                                value: AlertConditionType.ABSOLUTE_VALUE,
                                                            },
                                                            {
                                                                label: 'increases by',
                                                                value: AlertConditionType.RELATIVE_INCREASE,
                                                                disabledReason:
                                                                    isNonTimeSeriesDisplay &&
                                                                    'This condition is only supported for time series trends',
                                                            },
                                                            {
                                                                label: 'decreases by',
                                                                value: AlertConditionType.RELATIVE_DECREASE,
                                                                disabledReason:
                                                                    isNonTimeSeriesDisplay &&
                                                                    'This condition is only supported for time series trends',
                                                            },
                                                        ]}
                                                    />
                                                </LemonField>
                                            </Group>
                                        </div>
                                    )}
                                    {!alertForm?.config?.detector_config?.type && (
                                        <div className="flex gap-4 items-center">
                                            <div>less than</div>
                                            <LemonField name="lower">
                                                <LemonInput
                                                    type="number"
                                                    className="w-30"
                                                    data-attr="alertForm-lower-threshold"
                                                    value={
                                                        alertForm.threshold.configuration.type ===
                                                            InsightThresholdType.PERCENTAGE &&
                                                        alertForm.threshold.configuration.bounds?.lower
                                                            ? alertForm.threshold.configuration.bounds?.lower * 100
                                                            : alertForm.threshold.configuration.bounds?.lower
                                                    }
                                                    onChange={(value) =>
                                                        setAlertFormValue('threshold', {
                                                            configuration: {
                                                                type: alertForm.threshold.configuration.type,
                                                                bounds: {
                                                                    ...alertForm.threshold.configuration.bounds,
                                                                    lower:
                                                                        value &&
                                                                        alertForm.threshold.configuration.type ===
                                                                            InsightThresholdType.PERCENTAGE
                                                                            ? value / 100
                                                                            : value,
                                                                },
                                                            },
                                                        })
                                                    }
                                                />
                                            </LemonField>
                                            <div>or more than</div>
                                            <LemonField name="upper">
                                                <LemonInput
                                                    type="number"
                                                    className="w-30"
                                                    data-attr="alertForm-upper-threshold"
                                                    value={
                                                        alertForm.threshold.configuration.type ===
                                                            InsightThresholdType.PERCENTAGE &&
                                                        alertForm.threshold.configuration.bounds?.upper
                                                            ? alertForm.threshold.configuration.bounds?.upper * 100
                                                            : alertForm.threshold.configuration.bounds?.upper
                                                    }
                                                    onChange={(value) =>
                                                        setAlertFormValue('threshold', {
                                                            configuration: {
                                                                type: alertForm.threshold.configuration.type,
                                                                bounds: {
                                                                    ...alertForm.threshold.configuration.bounds,
                                                                    upper:
                                                                        value &&
                                                                        alertForm.threshold.configuration.type ===
                                                                            InsightThresholdType.PERCENTAGE
                                                                            ? value / 100
                                                                            : value,
                                                                },
                                                            },
                                                        })
                                                    }
                                                />
                                            </LemonField>
                                            {alertForm.condition.type !== AlertConditionType.ABSOLUTE_VALUE && (
                                                <Group name={['threshold', 'configuration']}>
                                                    <LemonField name="type">
                                                        <LemonSegmentedButton
                                                            options={[
                                                                {
                                                                    value: InsightThresholdType.PERCENTAGE,
                                                                    label: '%',
                                                                    tooltip: 'Percent',
                                                                },
                                                                {
                                                                    value: InsightThresholdType.ABSOLUTE,
                                                                    label: '#',
                                                                    tooltip: 'Absolute number',
                                                                },
                                                            ]}
                                                        />
                                                    </LemonField>
                                                </Group>
                                            )}
                                        </div>
                                    )}
                                    <div className="flex gap-4 items-center">
                                        <div>Run alert every</div>
                                        <LemonField name="calculation_interval">
                                            <LemonSelect
                                                fullWidth
                                                className="w-28"
                                                data-attr="alertForm-calculation-interval"
                                                options={Object.values(AlertCalculationInterval).map((interval) => ({
                                                    label: alertCalculationIntervalToLabel(interval),
                                                    value: interval,
                                                }))}
                                            />
                                        </LemonField>
                                        <div>
                                            and check {alertForm?.config.check_ongoing_interval ? 'current' : 'last'}
                                        </div>
                                        <LemonSelect
                                            fullWidth
                                            className="w-28"
                                            data-attr="alertForm-trend-interval"
                                            disabledReason={
                                                <>
                                                    To change the interval being checked, edit and <b>save</b> the
                                                    interval which the insight is 'grouped by'
                                                </>
                                            }
                                            value={trendInterval ?? 'day'}
                                            options={[
                                                {
                                                    label: trendInterval ?? 'day',
                                                    value: trendInterval ?? 'day',
                                                },
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <h3>Notification</h3>
                                <div className="flex gap-4 items-center mt-2">
                                    <div>E-mail</div>
                                    <div className="flex-auto">
                                        <MemberSelectMultiple
                                            value={alertForm.subscribed_users?.map((u: { id: number }) => u.id) ?? []}
                                            idKey="id"
                                            onChange={(value) => setAlertFormValue('subscribed_users', value)}
                                        />
                                    </div>
                                </div>

                                <h4 className="mt-4">CDP Destinations</h4>
                                <div className="mt-2">
                                    {alertId ? (
                                        <div className="flex flex-col">
                                            <AlertDestinationSelector alertId={alertId} />
                                        </div>
                                    ) : (
                                        <div className="text-muted-alt">
                                            Save alert first to add destinations (e.g. Slack, Webhooks)
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="deprecated-space-y-2">
                                <LemonCollapse
                                    panels={[
                                        {
                                            key: 'advanced',
                                            header: 'Advanced options',
                                            content: (
                                                <div className="space-y-2">
                                                    <Group name={['config']}>
                                                        <div className="flex gap-1">
                                                            <LemonField name="check_ongoing_interval">
                                                                <LemonCheckbox
                                                                    checked={
                                                                        can_check_ongoing_interval &&
                                                                        alertForm?.config.check_ongoing_interval
                                                                    }
                                                                    data-attr="alertForm-check-ongoing-interval"
                                                                    fullWidth
                                                                    label="Check ongoing period"
                                                                    disabledReason={
                                                                        !can_check_ongoing_interval &&
                                                                        'Can only alert for ongoing period when checking for absolute value/increase above a set upper threshold.'
                                                                    }
                                                                />
                                                            </LemonField>
                                                            <Tooltip
                                                                title={`Checks the insight value for the ongoing period (current week/month) that hasn't yet completed. Use this if you want to be alerted right away when the insight value rises/increases above threshold`}
                                                                placement="right"
                                                                delayMs={0}
                                                            >
                                                                <IconInfo />
                                                            </Tooltip>
                                                        </div>
                                                    </Group>
                                                    <LemonField name="skip_weekend">
                                                        <LemonCheckbox
                                                            checked={
                                                                (alertForm?.calculation_interval ===
                                                                    AlertCalculationInterval.DAILY ||
                                                                    alertForm?.calculation_interval ===
                                                                        AlertCalculationInterval.HOURLY) &&
                                                                alertForm?.skip_weekend
                                                            }
                                                            data-attr="alertForm-skip-weekend"
                                                            fullWidth
                                                            label="Skip checking on weekends"
                                                            disabledReason={
                                                                alertForm?.calculation_interval !==
                                                                    AlertCalculationInterval.DAILY &&
                                                                alertForm?.calculation_interval !==
                                                                    AlertCalculationInterval.HOURLY &&
                                                                'Can only skip weekend checking for hourly/daily alerts'
                                                            }
                                                        />
                                                    </LemonField>
                                                </div>
                                            ),
                                        },
                                    ]}
                                />
                            </div>
                        </div>

                        {alert && <AlertStateTable alert={alert} />}
                    </LemonModal.Content>

                    <LemonModal.Footer>
                        <div className="flex-1">
                            <div className="flex gap-2">
                                {!creatingNewAlert ? (
                                    <LemonButton type="secondary" status="danger" onClick={deleteAlert}>
                                        Delete alert
                                    </LemonButton>
                                ) : null}
                                {!creatingNewAlert && alert?.state === AlertState.FIRING ? (
                                    <SnoozeButton onChange={snoozeAlert} value={alert?.snoozed_until} />
                                ) : null}
                                {!creatingNewAlert && alert?.state === AlertState.SNOOZED ? (
                                    <LemonButton
                                        type="secondary"
                                        status="default"
                                        onClick={clearSnooze}
                                        tooltip={`Currently snoozed until ${formatDate(
                                            dayjs(alert?.snoozed_until),
                                            'MMM D, HH:mm'
                                        )}`}
                                    >
                                        Clear snooze
                                    </LemonButton>
                                ) : null}
                            </div>
                        </div>
                        <LemonButton
                            type="primary"
                            htmlType="submit"
                            loading={isAlertFormSubmitting}
                            disabledReason={!alertFormChanged && 'No changes to save'}
                        >
                            {creatingNewAlert ? 'Create alert' : 'Save'}
                        </LemonButton>
                    </LemonModal.Footer>
                </Form>
            )}
        </LemonModal>
    )
}
