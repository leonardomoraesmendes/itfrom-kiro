import { useState } from 'react';
import {
  Text,
  Button,
  MessageBar,
  MessageBarBody,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  CheckmarkRegular,
  DismissRegular,
  ArrowUndoRegular,
  TimerRegular,
  LockClosedRegular,
} from '@fluentui/react-icons';
import type { DocumentoFiscal } from '@ap-automation/shared';
import type { TimelineEvent } from '../components/HistoryTimeline';
import { DocumentHeader } from '../components/DocumentHeader';
import { HistoryTimeline } from '../components/HistoryTimeline';
import { JustificationModal } from '../components/JustificationModal';

export interface AprovacaoAlcadasProps {
  document: DocumentoFiscal;
  historyEvents: TimelineEvent[];
  slaRemaining: string;
  blocked: boolean;
  blockReason?: string;
  onApprove: () => void;
  onReject: (justificativa: string) => void;
  onReturn: (justificativa: string) => void;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    paddingBottom: '80px', // space for fixed action bar
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalS,
  },
  sectionTitle: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
  slaBar: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
    padding: tokens.spacingVerticalS,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  slaIcon: {
    fontSize: '20px',
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    alignItems: 'center',
  },
  actionBar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    display: 'flex',
    justifyContent: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground1,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
    zIndex: 100,
  },
  blockMessage: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
});

export const AprovacaoAlcadas: React.FC<AprovacaoAlcadasProps> = ({
  document: doc,
  historyEvents,
  slaRemaining,
  blocked,
  blockReason,
  onApprove,
  onReject,
  onReturn,
}) => {
  const styles = useStyles();
  const [modalAction, setModalAction] = useState<'rejeitar' | 'devolver' | null>(null);

  const handleModalConfirm = (justificativa: string) => {
    if (modalAction === 'rejeitar') {
      onReject(justificativa);
    } else if (modalAction === 'devolver') {
      onReturn(justificativa);
    }
    setModalAction(null);
  };

  const modalTitle =
    modalAction === 'rejeitar'
      ? 'Justificativa para rejeição'
      : 'Justificativa para devolução';

  return (
    <div className={styles.container}>
      {/* Document Header */}
      <DocumentHeader
        valor={doc.valorTotal}
        fornecedor={doc.cnpjEmitente}
        dataVencimento={doc.dataVencimento}
        centroCusto="Centro de Custo"
      />

      {/* SLA Countdown */}
      <div className={styles.slaBar} role="status" aria-label="SLA restante">
        <span className={styles.slaIcon}>
          <TimerRegular aria-hidden="true" />
        </span>
        <Text>SLA restante: {slaRemaining}</Text>
      </div>

      {/* Block message */}
      {blocked && blockReason && (
        <MessageBar intent="error">
          <MessageBarBody>
            <span className={styles.blockMessage}>
              <LockClosedRegular aria-hidden="true" />
              {blockReason}
            </span>
          </MessageBarBody>
        </MessageBar>
      )}

      {/* History Timeline */}
      <div className={styles.section}>
        <Text className={styles.sectionTitle}>Histórico de Etapas</Text>
        <HistoryTimeline events={historyEvents} />
      </div>

      {/* Fixed Action Bar */}
      <div className={styles.actionBar} role="toolbar" aria-label="Ações de aprovação">
        <Button
          appearance="primary"
          icon={<CheckmarkRegular />}
          disabled={blocked}
          onClick={onApprove}
        >
          Aprovar
        </Button>
        <Button
          appearance="primary"
          icon={<DismissRegular />}
          disabled={blocked}
          onClick={() => setModalAction('rejeitar')}
          style={{ backgroundColor: blocked ? undefined : tokens.colorPaletteRedBackground3 }}
        >
          Rejeitar
        </Button>
        <Button
          appearance="secondary"
          icon={<ArrowUndoRegular />}
          disabled={blocked}
          onClick={() => setModalAction('devolver')}
        >
          Devolver
        </Button>
      </div>

      {/* Justification Modal */}
      <JustificationModal
        open={modalAction !== null}
        title={modalTitle}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalAction(null)}
      />
    </div>
  );
};
