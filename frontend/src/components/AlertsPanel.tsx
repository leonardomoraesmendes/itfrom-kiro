import {
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Button,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import type { MessageBarIntent } from '@fluentui/react-components';
import {
  ErrorCircleRegular,
  WarningRegular,
  InfoRegular,
} from '@fluentui/react-icons';

export type AlertSeverity = 'critica' | 'alta' | 'media' | 'baixa';

export interface AlertItem {
  tipo: string;
  mensagem: string;
  severidade: AlertSeverity;
  protocoloUnico?: string;
  onAction?: () => void;
}

export interface AlertsPanelProps {
  alerts: AlertItem[];
  actionLabel?: string;
}

const severityToIntent: Record<AlertSeverity, MessageBarIntent> = {
  critica: 'error',
  alta: 'warning',
  media: 'info',
  baixa: 'info',
};

const severityLabels: Record<AlertSeverity, string> = {
  critica: 'Crítico',
  alta: 'Alta prioridade',
  media: 'Informação',
  baixa: 'Informação',
};

const SeverityIcon: React.FC<{ severidade: AlertSeverity }> = ({ severidade }) => {
  switch (severidade) {
    case 'critica':
      return <ErrorCircleRegular aria-hidden="true" />;
    case 'alta':
      return <WarningRegular aria-hidden="true" />;
    case 'media':
    case 'baixa':
      return <InfoRegular aria-hidden="true" />;
  }
};

const useStyles = makeStyles({
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  messageContent: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
});

export const AlertsPanel: React.FC<AlertsPanelProps> = ({
  alerts,
  actionLabel = 'Ver detalhes',
}) => {
  const styles = useStyles();

  if (alerts.length === 0) {
    return null;
  }

  return (
    <div
      className={styles.panel}
      role="region"
      aria-label="Painel de alertas"
      aria-live="polite"
    >
      {alerts.map((alert, index) => (
        <MessageBar
          key={`${alert.tipo}-${alert.protocoloUnico ?? index}`}
          intent={severityToIntent[alert.severidade]}
        >
          <MessageBarBody>
            <span className={styles.messageContent}>
              <SeverityIcon severidade={alert.severidade} />
              <span>
                <strong>{severityLabels[alert.severidade]}:</strong> {alert.mensagem}
              </span>
            </span>
          </MessageBarBody>
          {alert.onAction && (
            <MessageBarActions>
              <Button size="small" onClick={alert.onAction}>
                {actionLabel}
              </Button>
            </MessageBarActions>
          )}
        </MessageBar>
      ))}
    </div>
  );
};
