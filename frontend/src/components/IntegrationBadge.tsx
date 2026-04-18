import {
  Badge,
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkCircleRegular,
  ErrorCircleRegular,
  ArrowSyncRegular,
  ClockRegular,
} from '@fluentui/react-icons';

export type IntegrationStatus = 'registrado' | 'erro' | 'reprocessando' | 'pendente';

export interface IntegrationBadgeProps {
  status: IntegrationStatus;
  erpTransactionId?: string;
}

const statusConfig: Record<
  IntegrationStatus,
  { label: string; color: 'success' | 'danger' | 'warning' | 'informative'; Icon: React.FC<{ className?: string }> }
> = {
  registrado: { label: 'Registrado', color: 'success', Icon: CheckmarkCircleRegular },
  erro: { label: 'Erro', color: 'danger', Icon: ErrorCircleRegular },
  reprocessando: { label: 'Reprocessando', color: 'warning', Icon: ArrowSyncRegular },
  pendente: { label: 'Pendente', color: 'informative', Icon: ClockRegular },
};

const useStyles = makeStyles({
  container: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  transactionId: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
});

export const IntegrationBadge: React.FC<IntegrationBadgeProps> = ({
  status,
  erpTransactionId,
}) => {
  const styles = useStyles();
  const config = statusConfig[status];
  const { Icon } = config;

  const ariaLabel = erpTransactionId
    ? `Integração: ${config.label} — ERP ${erpTransactionId}`
    : `Integração: ${config.label}`;

  return (
    <span className={styles.container} aria-label={ariaLabel} role="status">
      <Badge
        appearance="filled"
        color={config.color}
        icon={<Icon />}
      >
        {config.label}
      </Badge>
      {erpTransactionId && (
        <Text className={styles.transactionId}>ERP: {erpTransactionId}</Text>
      )}
    </span>
  );
};
