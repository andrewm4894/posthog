import { useActions, useValues } from 'kea'
import { router } from 'kea-router'

import { Link } from '@posthog/lemon-ui'

import { LemonButton } from 'lib/lemon-ui/LemonButton'
import { LemonModal } from 'lib/lemon-ui/LemonModal'
import { LemonTag } from 'lib/lemon-ui/LemonTag'
import { ProfileBubbles } from 'lib/lemon-ui/ProfilePicture'
import { pluralize } from 'lib/utils'
import { urls } from 'scenes/urls'

import { AlertState, InsightThresholdType } from '~/queries/schema/schema-general'
import { InsightShortId } from '~/types'

import { InsightAlertsLogicProps, insightAlertsLogic } from '../insightAlertsLogic'
import { AlertType } from '../types'

export function AlertStateIndicator({ alert }: { alert: AlertType }): JSX.Element {
    switch (alert.state) {
        case AlertState.FIRING:
            return <LemonTag type="danger">FIRING</LemonTag>
        case AlertState.ERRORED:
            return <LemonTag type="danger">ERRORED</LemonTag>
        case AlertState.SNOOZED:
            return <LemonTag type="muted">SNOOZED</LemonTag>
        case AlertState.NOT_FIRING:
            return <LemonTag type="success">NOT FIRING</LemonTag>
    }
}

interface AlertListItemProps {
    alert: AlertType
    onClick: () => void
}

const DETECTOR_CONFIGS = {
    threshold: (alert: AlertType) => {
        const bounds = alert.threshold?.configuration?.bounds
        const isPercentage = alert.threshold?.configuration.type === InsightThresholdType.PERCENTAGE

        if (!bounds?.lower && !bounds?.upper) {
            return null
        }

        const parts = []
        if (bounds?.lower != null) {
            const value = isPercentage ? bounds.lower * 100 : bounds.lower
            const suffix = isPercentage ? '%' : ''
            parts.push(`low ${value}${suffix}`)
        }
        if (bounds?.upper != null) {
            const value = isPercentage ? bounds.upper * 100 : bounds.upper
            const suffix = isPercentage ? '%' : ''
            parts.push(`high ${value}${suffix}`)
        }
        return parts.join(' · ')
    },
    zscore: (alert: AlertType) => {
        const config = alert.config?.detector_config
        const threshold = config?.z_threshold || 3.0
        const direction = config?.direction || 'both'
        const on = config?.on || 'value'
        const window = config?.window || 30
        return `z=${threshold} · ${direction} · ${on} · w=${window}`
    },
    mad: (alert: AlertType) => {
        const config = alert.config?.detector_config
        const k = config?.k || 3.5
        const direction = config?.direction || 'both'
        const on = config?.on || 'value'
        const window = config?.window || 30
        return `k=${k} · ${direction} · ${on} · w=${window}`
    },
} as const

export function AlertListItem({ alert, onClick }: AlertListItemProps): JSX.Element {
    const detectorType = alert.config?.detector_config?.type || 'threshold'

    const getDetectorParams = (): string | null => {
        if (!alert.enabled) {
            return 'Disabled'
        }

        const configFn = DETECTOR_CONFIGS[detectorType as keyof typeof DETECTOR_CONFIGS]
        return configFn ? configFn(alert) : null
    }

    const params = getDetectorParams()

    return (
        <LemonButton type="secondary" onClick={onClick} data-attr="alert-list-item" fullWidth>
            <div className="flex justify-between flex-auto items-center p-2">
                <div className="flex flex-row gap-3 items-center">
                    <span>{alert.name}</span>
                    <AlertStateIndicator alert={alert} />

                    {params && <div className="text-secondary pl-3">{params}</div>}
                </div>

                <ProfileBubbles limit={4} people={alert.subscribed_users?.map(({ email }) => ({ email }))} />
            </div>
        </LemonButton>
    )
}

interface ManageAlertsModalProps extends InsightAlertsLogicProps {
    isOpen: boolean
    insightShortId: InsightShortId
    onClose?: () => void
}

export function ManageAlertsModal(props: ManageAlertsModalProps): JSX.Element {
    const { push } = useActions(router)
    const logic = insightAlertsLogic(props)

    const { alerts } = useValues(logic)

    return (
        <LemonModal onClose={props.onClose} isOpen={props.isOpen} width={600} simple title="">
            <LemonModal.Header>
                <h3 className="!m-0">Manage Alerts</h3>
            </LemonModal.Header>
            <LemonModal.Content>
                <div className="mb-4">
                    With alerts, PostHog will monitor your insight and notify you when certain conditions are met. We do
                    not evaluate alerts in real-time, but rather on a schedule (hourly, daily...).
                    <br />
                    <Link to={urls.alerts()} target="_blank">
                        View all your alerts here
                    </Link>
                </div>

                {alerts.length ? (
                    <div className="deprecated-space-y-2">
                        <div>
                            <strong>{alerts?.length}</strong> {pluralize(alerts.length || 0, 'alert', 'alerts', false)}
                        </div>

                        {alerts.map((alert) => (
                            <AlertListItem
                                key={alert.id}
                                alert={alert}
                                onClick={() => push(urls.insightAlert(props.insightShortId, alert.id))}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col p-4 items-center text-center">
                        <h3>There are no alerts for this insight</h3>

                        <p>Once alerts are created they will display here. </p>
                    </div>
                )}
            </LemonModal.Content>

            <LemonModal.Footer>
                <LemonButton type="primary" onClick={() => push(urls.insightAlert(props.insightShortId, 'new'))}>
                    New alert
                </LemonButton>
                <LemonButton type="secondary" onClick={props.onClose}>
                    Close
                </LemonButton>
            </LemonModal.Footer>
        </LemonModal>
    )
}
