import {
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

export interface TimelineEvent {
  dataHora: Date;
  tipoAcao: string;
  usuarioId: string;
  descricao: string;
}

export interface HistoryTimelineProps {
  events: TimelineEvent[];
}

/**
 * Formats a Date to a localized date+time string (dd/mm/yyyy HH:mm).
 */
export function formatDateTime(date: Date): string {
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const useStyles = makeStyles({
  list: {
    listStyle: 'none',
    padding: '0',
    margin: '0',
    position: 'relative',
  },
  item: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    paddingBottom: tokens.spacingVerticalL,
    position: 'relative',
  },
  marker: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    minWidth: '16px',
  },
  dot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: tokens.colorBrandBackground,
    flexShrink: 0,
  },
  line: {
    width: '2px',
    flexGrow: 1,
    backgroundColor: tokens.colorNeutralStroke2,
    marginTop: tokens.spacingVerticalXS,
  },
  content: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXXS,
    paddingBottom: tokens.spacingVerticalXS,
  },
  action: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  meta: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  description: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground1,
  },
  empty: {
    color: tokens.colorNeutralForeground2,
    fontStyle: 'italic',
    padding: tokens.spacingVerticalM,
  },
});

export const HistoryTimeline: React.FC<HistoryTimelineProps> = ({ events }) => {
  const styles = useStyles();

  if (events.length === 0) {
    return (
      <Text className={styles.empty} role="status">
        Nenhum evento registrado.
      </Text>
    );
  }

  return (
    <ol className={styles.list} aria-label="Histórico de eventos do documento">
      {events.map((event, index) => (
        <li key={index} className={styles.item}>
          <div className={styles.marker} aria-hidden="true">
            <span className={styles.dot} />
            {index < events.length - 1 && <span className={styles.line} />}
          </div>
          <div className={styles.content}>
            <Text className={styles.action}>{event.tipoAcao}</Text>
            <Text className={styles.meta}>
              <time dateTime={event.dataHora.toISOString()}>
                {formatDateTime(event.dataHora)}
              </time>
              {' — '}
              {event.usuarioId}
            </Text>
            <Text className={styles.description}>{event.descricao}</Text>
          </div>
        </li>
      ))}
    </ol>
  );
};
