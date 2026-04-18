import { useState } from 'react';
import {
  makeStyles,
  Text,
  Badge,
  Button,
  tokens,
  Table,
  TableHeader,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
} from '@fluentui/react-components';
import {
  ShieldCheckmarkRegular,
  ShieldDismissRegular,
  LockClosedRegular,
  CheckmarkCircleRegular,
  DismissCircleRegular,
} from '@fluentui/react-icons';
import type { DocumentoFiscal } from '@ap-automation/shared';
import type { ValidationResult, RuleResult, DuplicateCheckResult } from '@ap-automation/shared/src/types/services';
import { DocumentHeader, formatCurrency, formatDate } from '../components/DocumentHeader';
import { JustificationModal } from '../components/JustificationModal';

export interface ValidacoesAntiDuplicidadeProps {
  document: DocumentoFiscal;
  validationResult: ValidationResult;
  duplicateResult: DuplicateCheckResult;
  onLiberar: (justificativa: string) => void;
  onRejeitar: (justificativa: string) => void;
  onBloquear: () => void;
}

type ModalAction = 'liberar' | 'rejeitar' | null;

const criticidadeColor: Record<RuleResult['criticidade'], 'danger' | 'warning' | 'informative' | 'success'> = {
  critica: 'danger',
  alta: 'warning',
  media: 'informative',
  baixa: 'success',
};

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
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
  ruleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalM,
    padding: tokens.spacingVerticalXS,
  },
  ruleIcon: {
    fontSize: '20px',
    display: 'flex',
    alignItems: 'center',
  },
  decisionPanel: {
    display: 'flex',
    gap: tokens.spacingHorizontalM,
    paddingTop: tokens.spacingVerticalM,
    borderTop: `1px solid ${tokens.colorNeutralStroke1}`,
  },
  comparisonContainer: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    flexWrap: 'wrap',
  },
  comparisonCard: {
    flex: '1 1 300px',
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  comparisonTitle: {
    fontWeight: tokens.fontWeightSemibold,
    marginBottom: tokens.spacingVerticalS,
  },
});

export const ValidacoesAntiDuplicidade: React.FC<ValidacoesAntiDuplicidadeProps> = ({
  document: doc,
  validationResult,
  duplicateResult,
  onLiberar,
  onRejeitar,
  onBloquear,
}) => {
  const styles = useStyles();
  const [modalAction, setModalAction] = useState<ModalAction>(null);

  const handleModalConfirm = (justificativa: string) => {
    if (modalAction === 'liberar') {
      onLiberar(justificativa);
    } else if (modalAction === 'rejeitar') {
      onRejeitar(justificativa);
    }
    setModalAction(null);
  };

  const modalTitle =
    modalAction === 'liberar'
      ? 'Justificativa para liberação de duplicata'
      : 'Justificativa para rejeição';

  return (
    <div className={styles.container}>
      {/* Document summary header */}
      <DocumentHeader
        valor={doc.valorTotal}
        fornecedor={doc.cnpjEmitente}
        dataVencimento={doc.dataVencimento}
        centroCusto={doc.cnpjDestinatario}
      />

      {/* Validation rules list */}
      <div className={styles.section} role="region" aria-label="Resultados de validação">
        <Text className={styles.sectionTitle}>Validações</Text>
        {validationResult.regras.map((regra, idx) => (
          <div className={styles.ruleRow} key={idx} role="listitem">
            <span className={styles.ruleIcon}>
              {regra.status === 'aprovada' ? (
                <ShieldCheckmarkRegular aria-hidden="true" />
              ) : (
                <ShieldDismissRegular aria-hidden="true" />
              )}
            </span>
            <Badge
              color={regra.status === 'aprovada' ? 'success' : 'danger'}
              appearance="filled"
              aria-label={`Status: ${regra.status}`}
            >
              {regra.status}
            </Badge>
            <Text>{regra.regra}</Text>
            <Badge
              color={criticidadeColor[regra.criticidade]}
              appearance="tint"
              aria-label={`Criticidade: ${regra.criticidade}`}
            >
              {regra.criticidade}
            </Badge>
            {regra.detalhes && (
              <Text size={200} style={{ color: tokens.colorNeutralForeground2 }}>
                {regra.detalhes}
              </Text>
            )}
          </div>
        ))}
      </div>

      {/* Similar documents comparison */}
      {duplicateResult.documentosSimilares.length > 0 && (
        <div className={styles.section} role="region" aria-label="Documentos similares">
          <Text className={styles.sectionTitle}>Documentos Similares</Text>
          <Table aria-label="Comparação de documentos similares">
            <TableHeader>
              <TableRow>
                <TableHeaderCell>Protocolo</TableHeaderCell>
                <TableHeaderCell>CNPJ Emitente</TableHeaderCell>
                <TableHeaderCell>Nº Documento</TableHeaderCell>
                <TableHeaderCell>Valor</TableHeaderCell>
                <TableHeaderCell>Data Emissão</TableHeaderCell>
                <TableHeaderCell>Status</TableHeaderCell>
              </TableRow>
            </TableHeader>
            <TableBody>
              {/* Current document row */}
              <TableRow>
                <TableCell>{doc.protocoloUnico}</TableCell>
                <TableCell>{doc.cnpjEmitente}</TableCell>
                <TableCell>{doc.numeroDocumento}</TableCell>
                <TableCell>{formatCurrency(doc.valorTotal)}</TableCell>
                <TableCell>{formatDate(doc.dataEmissao)}</TableCell>
                <TableCell>
                  <Badge color="informative" appearance="tint">Atual</Badge>
                </TableCell>
              </TableRow>
              {/* Similar documents */}
              {duplicateResult.documentosSimilares.map((similar) => (
                <TableRow key={similar.protocoloUnico}>
                  <TableCell>{similar.protocoloUnico}</TableCell>
                  <TableCell>{similar.cnpjEmitente}</TableCell>
                  <TableCell>{similar.numeroDocumento}</TableCell>
                  <TableCell>{formatCurrency(similar.valorTotal)}</TableCell>
                  <TableCell>{formatDate(similar.dataEmissao)}</TableCell>
                  <TableCell>
                    <Badge color="warning" appearance="tint">Similar</Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Decision panel */}
      <div className={styles.section} role="region" aria-label="Painel de decisão">
        <Text className={styles.sectionTitle}>Decisão</Text>
        <div className={styles.decisionPanel}>
          <Button
            appearance="secondary"
            icon={<LockClosedRegular />}
            onClick={onBloquear}
          >
            Bloquear
          </Button>
          <Button
            appearance="primary"
            icon={<CheckmarkCircleRegular />}
            onClick={() => setModalAction('liberar')}
          >
            Justificar e Liberar
          </Button>
          <Button
            appearance="secondary"
            icon={<DismissCircleRegular />}
            onClick={() => setModalAction('rejeitar')}
            style={{ color: tokens.colorPaletteRedForeground1 }}
          >
            Rejeitar
          </Button>
        </div>
      </div>

      {/* Justification modal */}
      <JustificationModal
        open={modalAction !== null}
        title={modalTitle}
        onConfirm={handleModalConfirm}
        onCancel={() => setModalAction(null)}
      />
    </div>
  );
};
