import {
  makeStyles,
  Text,
  tokens,
  Spinner,
} from '@fluentui/react-components';
import { AlertsPanel } from '../components/AlertsPanel';
import type { AlertItem } from '../components/AlertsPanel';
import { AssistedReviewForm } from '../components/AssistedReviewForm';
import type { ReviewField } from '../components/AssistedReviewForm';

export interface CapturaValidacaoProps {
  documentPreviewUrl: string;
  fields: ReviewField[];
  onFieldChange: (index: number, newValue: string) => void;
  onSubmit: () => void;
  onAutoSave?: () => void;
  alerts: AlertItem[];
  saving: boolean;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalM,
    padding: tokens.spacingVerticalL,
    height: '100%',
  },
  savingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: tokens.spacingHorizontalS,
  },
  formWrapper: {
    flex: 1,
    minHeight: '400px',
  },
});

export const CapturaValidacao: React.FC<CapturaValidacaoProps> = ({
  documentPreviewUrl,
  fields,
  onFieldChange,
  onSubmit,
  alerts,
  saving,
}) => {
  const styles = useStyles();

  return (
    <div className={styles.container}>
      {/* Alerts for field warnings and inconsistencies */}
      <AlertsPanel alerts={alerts} actionLabel="Revisar campo" />

      {/* Auto-save indicator */}
      {saving && (
        <div
          className={styles.savingIndicator}
          role="status"
          aria-live="polite"
          aria-label="Salvamento automático em andamento"
        >
          <Spinner size="tiny" />
          <Text size={200}>Salvando automaticamente...</Text>
        </div>
      )}

      {/* Split-view: document preview (left) + structured form (right) */}
      <div className={styles.formWrapper}>
        <AssistedReviewForm
          documentPreviewUrl={documentPreviewUrl}
          fields={fields}
          onFieldChange={onFieldChange}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
};
