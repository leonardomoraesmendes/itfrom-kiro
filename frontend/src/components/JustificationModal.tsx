import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogContent,
  DialogActions,
  Button,
  Textarea,
  Label,
  makeStyles,
  tokens,
} from '@fluentui/react-components';

export interface JustificationModalProps {
  open: boolean;
  title: string;
  onConfirm: (justificativa: string) => void;
  onCancel: () => void;
}

const useStyles = makeStyles({
  textarea: {
    width: '100%',
    minHeight: '120px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
  errorText: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorPaletteRedForeground1,
  },
});

export const JustificationModal: React.FC<JustificationModalProps> = ({
  open,
  title,
  onConfirm,
  onCancel,
}) => {
  const styles = useStyles();
  const [justificativa, setJustificativa] = useState('');
  const [touched, setTouched] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isEmpty = justificativa.trim() === '';
  const showError = touched && isEmpty;

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setJustificativa('');
      setTouched(false);
    }
  }, [open]);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [open]);

  const handleConfirm = () => {
    setTouched(true);
    if (!isEmpty) {
      onConfirm(justificativa.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(_e, data) => { if (!data.open) onCancel(); }}>
      <DialogSurface>
        <DialogBody>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <div className={styles.fieldGroup}>
              <Label htmlFor="justificativa-input" required>
                Justificativa
              </Label>
              <Textarea
                id="justificativa-input"
                ref={textareaRef}
                className={styles.textarea}
                value={justificativa}
                onChange={(_e, data) => setJustificativa(data.value)}
                onBlur={() => setTouched(true)}
                placeholder="Descreva a justificativa..."
                aria-required="true"
                aria-describedby={showError ? 'justificativa-error' : undefined}
                aria-invalid={showError}
              />
              {showError && (
                <span id="justificativa-error" className={styles.errorText} role="alert">
                  Justificativa é obrigatória
                </span>
              )}
            </div>
          </DialogContent>
          <DialogActions>
            <Button appearance="secondary" onClick={onCancel}>
              Cancelar
            </Button>
            <Button appearance="primary" onClick={handleConfirm} disabled={isEmpty}>
              Confirmar
            </Button>
          </DialogActions>
        </DialogBody>
      </DialogSurface>
    </Dialog>
  );
};
