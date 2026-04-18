import {
  makeStyles,
  tokens,
  Input,
  Label,
  Button,
  Badge,
  mergeClasses,
} from '@fluentui/react-components';
import {
  WarningRegular,
  ErrorCircleRegular,
} from '@fluentui/react-icons';

export interface ReviewField {
  nome: string;
  valor: string;
  indiceConfianca: number;
  requerRevisao: boolean;
}

export interface AssistedReviewFormProps {
  documentPreviewUrl: string;
  fields: ReviewField[];
  onFieldChange: (index: number, newValue: string) => void;
  onSubmit: () => void;
}

const CONFIDENCE_THRESHOLD = 85;

const useStyles = makeStyles({
  container: {
    display: 'flex',
    gap: tokens.spacingHorizontalL,
    height: '100%',
    minHeight: '400px',
  },
  previewPane: {
    flex: '1 1 50%',
    border: `1px solid ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewFrame: {
    width: '100%',
    height: '100%',
    border: 'none',
  },
  formPane: {
    flex: '1 1 50%',
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    overflowY: 'auto',
    paddingRight: tokens.spacingHorizontalS,
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  labelRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  confidenceBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
    fontSize: tokens.fontSizeBase200,
  },
  lowConfidence: {
    backgroundColor: '#FFF4CE',
  },
  requiredEmpty: {
    borderTopColor: tokens.colorPaletteRedBorder2,
    borderRightColor: tokens.colorPaletteRedBorder2,
    borderBottomColor: tokens.colorPaletteRedBorder2,
    borderLeftColor: tokens.colorPaletteRedBorder2,
    borderTopWidth: '2px',
    borderRightWidth: '2px',
    borderBottomWidth: '2px',
    borderLeftWidth: '2px',
    borderTopStyle: 'solid',
    borderRightStyle: 'solid',
    borderBottomStyle: 'solid',
    borderLeftStyle: 'solid',
    borderBottomLeftRadius: tokens.borderRadiusMedium,
    borderBottomRightRadius: tokens.borderRadiusMedium,
    borderTopLeftRadius: tokens.borderRadiusMedium,
    borderTopRightRadius: tokens.borderRadiusMedium,
  },
  helpText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalXS,
  },
  submitRow: {
    marginTop: tokens.spacingVerticalM,
    display: 'flex',
    justifyContent: 'flex-end',
  },
});

export const AssistedReviewForm: React.FC<AssistedReviewFormProps> = ({
  documentPreviewUrl,
  fields,
  onFieldChange,
  onSubmit,
}) => {
  const styles = useStyles();

  const hasEmptyRequired = fields.some(
    (f) => f.requerRevisao && f.valor.trim() === ''
  );

  return (
    <div className={styles.container} role="region" aria-label="Revisão assistida de documento">
      {/* Left: Document preview */}
      <div className={styles.previewPane}>
        <iframe
          className={styles.previewFrame}
          src={documentPreviewUrl}
          title="Pré-visualização do documento"
        />
      </div>

      {/* Right: Editable form */}
      <form
        className={styles.formPane}
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit();
        }}
        aria-label="Formulário de revisão de campos"
      >
        {fields.map((field, index) => {
          const isLowConfidence = field.indiceConfianca < CONFIDENCE_THRESHOLD;
          const isEmpty = field.valor.trim() === '';
          const isRequiredEmpty = field.requerRevisao && isEmpty;
          const helpId = `field-help-${index}`;

          return (
            <div key={field.nome} className={styles.fieldGroup}>
              <div className={styles.labelRow}>
                <Label htmlFor={`field-${index}`} required={field.requerRevisao}>
                  {field.nome}
                </Label>
                <span className={styles.confidenceBadge}>
                  <Badge
                    appearance="filled"
                    color={isLowConfidence ? 'warning' : 'success'}
                    size="small"
                  >
                    {field.indiceConfianca}%
                  </Badge>
                </span>
              </div>

              <Input
                id={`field-${index}`}
                value={field.valor}
                onChange={(_e, data) => onFieldChange(index, data.value)}
                aria-describedby={helpId}
                aria-required={field.requerRevisao}
                className={mergeClasses(
                  isLowConfidence && styles.lowConfidence,
                  isRequiredEmpty && styles.requiredEmpty
                )}
              />

              <span id={helpId} className={styles.helpText}>
                {isLowConfidence && (
                  <>
                    <WarningRegular aria-hidden="true" />
                    Confiança abaixo de {CONFIDENCE_THRESHOLD}% — revisão recomendada
                  </>
                )}
                {isRequiredEmpty && (
                  <>
                    <ErrorCircleRegular aria-hidden="true" />
                    Campo obrigatório não preenchido
                  </>
                )}
              </span>
            </div>
          );
        })}

        <div className={styles.submitRow}>
          <Button
            appearance="primary"
            type="submit"
            disabled={hasEmptyRequired}
          >
            Confirmar revisão
          </Button>
        </div>
      </form>
    </div>
  );
};
