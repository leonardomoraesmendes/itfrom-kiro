import {
  Card,
  CardHeader,
  Text,
  makeStyles,
  tokens,
  mergeClasses,
} from '@fluentui/react-components';
import {
  ArrowTrendingRegular,
  ArrowTrendingDownRegular,
  SubtractRegular,
} from '@fluentui/react-icons';

export type TrendDirection = 'up' | 'down' | 'stable';
export type Severity = 'success' | 'warning' | 'danger';

export interface KPICardProps {
  value: string | number;
  label: string;
  trend: TrendDirection;
  severity: Severity;
}

const useStyles = makeStyles({
  card: {
    minWidth: '200px',
    maxWidth: '300px',
    padding: tokens.spacingVerticalM,
  },
  valueRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  value: {
    fontSize: '28px',
    fontWeight: tokens.fontWeightBold,
    lineHeight: '36px',
  },
  label: {
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground2,
  },
  success: {
    color: '#107C10',
  },
  warning: {
    color: '#FFB900',
  },
  danger: {
    color: '#D13438',
  },
  trendIcon: {
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  borderSuccess: {
    borderTopColor: '#107C10',
    borderTopWidth: '3px',
    borderTopStyle: 'solid',
  },
  borderWarning: {
    borderTopColor: '#FFB900',
    borderTopWidth: '3px',
    borderTopStyle: 'solid',
  },
  borderDanger: {
    borderTopColor: '#D13438',
    borderTopWidth: '3px',
    borderTopStyle: 'solid',
  },
});

const trendLabels: Record<TrendDirection, string> = {
  up: 'Tendência de alta',
  down: 'Tendência de queda',
  stable: 'Estável',
};

const TrendIcon: React.FC<{ trend: TrendDirection; className?: string }> = ({
  trend,
  className,
}) => {
  switch (trend) {
    case 'up':
      return <ArrowTrendingRegular className={className} aria-hidden="true" />;
    case 'down':
      return <ArrowTrendingDownRegular className={className} aria-hidden="true" />;
    case 'stable':
      return <SubtractRegular className={className} aria-hidden="true" />;
  }
};

export const KPICard: React.FC<KPICardProps> = ({ value, label, trend, severity }) => {
  const styles = useStyles();

  const severityClass = styles[severity];
  const borderClass =
    severity === 'success'
      ? styles.borderSuccess
      : severity === 'warning'
        ? styles.borderWarning
        : styles.borderDanger;

  return (
    <Card className={mergeClasses(styles.card, borderClass)} role="region" aria-label={label}>
      <CardHeader header={<Text className={styles.label}>{label}</Text>} />
      <div className={styles.valueRow} aria-live="polite">
        <Text className={mergeClasses(styles.value, severityClass)}>{value}</Text>
        <span className={mergeClasses(styles.trendIcon, severityClass)} title={trendLabels[trend]}>
          <TrendIcon trend={trend} />
          <span className="visually-hidden">{trendLabels[trend]}</span>
        </span>
      </div>
    </Card>
  );
};
