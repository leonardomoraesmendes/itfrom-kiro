import {
  Text,
  makeStyles,
  tokens,
} from '@fluentui/react-components';
import {
  MoneyRegular,
  BuildingRegular,
  CalendarRegular,
  OrganizationRegular,
} from '@fluentui/react-icons';

export interface DocumentHeaderProps {
  valor: number; // centavos
  fornecedor: string;
  dataVencimento: Date;
  centroCusto: string;
}

/**
 * Formats a value in centavos to BRL currency string (R$ X.XXX,XX).
 */
export function formatCurrency(centavos: number): string {
  const reais = centavos / 100;
  return reais.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/**
 * Formats a Date to dd/mm/yyyy string.
 */
export function formatDate(date: Date): string {
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

const useStyles = makeStyles({
  header: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: tokens.spacingHorizontalXL,
    padding: tokens.spacingVerticalM,
    backgroundColor: tokens.colorNeutralBackground2,
    borderRadius: tokens.borderRadiusMedium,
  },
  field: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  icon: {
    fontSize: '20px',
    color: tokens.colorNeutralForeground2,
    display: 'flex',
    alignItems: 'center',
  },
  fieldContent: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground2,
  },
  value: {
    fontSize: tokens.fontSizeBase400,
    fontWeight: tokens.fontWeightSemibold,
  },
});

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  valor,
  fornecedor,
  dataVencimento,
  centroCusto,
}) => {
  const styles = useStyles();

  return (
    <div
      className={styles.header}
      role="region"
      aria-label="Resumo do documento"
    >
      <div className={styles.field}>
        <span className={styles.icon}>
          <MoneyRegular aria-hidden="true" />
        </span>
        <div className={styles.fieldContent}>
          <Text className={styles.label} id="doc-valor-label">Valor</Text>
          <Text className={styles.value} aria-labelledby="doc-valor-label">
            {formatCurrency(valor)}
          </Text>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.icon}>
          <BuildingRegular aria-hidden="true" />
        </span>
        <div className={styles.fieldContent}>
          <Text className={styles.label} id="doc-fornecedor-label">Fornecedor</Text>
          <Text className={styles.value} aria-labelledby="doc-fornecedor-label">
            {fornecedor}
          </Text>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.icon}>
          <CalendarRegular aria-hidden="true" />
        </span>
        <div className={styles.fieldContent}>
          <Text className={styles.label} id="doc-vencimento-label">Vencimento</Text>
          <Text className={styles.value} aria-labelledby="doc-vencimento-label">
            {formatDate(dataVencimento)}
          </Text>
        </div>
      </div>

      <div className={styles.field}>
        <span className={styles.icon}>
          <OrganizationRegular aria-hidden="true" />
        </span>
        <div className={styles.fieldContent}>
          <Text className={styles.label} id="doc-centro-custo-label">Centro de Custo</Text>
          <Text className={styles.value} aria-labelledby="doc-centro-custo-label">
            {centroCusto}
          </Text>
        </div>
      </div>
    </div>
  );
};
