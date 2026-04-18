import {
  Button,
  makeStyles,
  MessageBar,
  MessageBarBody,
  MessageBarActions,
  Text,
  tokens,
  ProgressBar,
} from '@fluentui/react-components';
import { ArrowUploadRegular, ArrowClockwiseRegular } from '@fluentui/react-icons';
import type { DocumentReceipt } from '@ap-automation/shared';
import { StatusTable } from '../components/StatusTable';
import type { ColumnDefinition } from '../components/StatusTable';
import { useRef, useState, useCallback } from 'react';

const ACCEPTED_FORMATS = ['application/pdf', 'text/xml', 'application/xml', 'image/jpeg', 'image/png'];
const ACCEPTED_EXTENSIONS = ['.pdf', '.xml', '.jpeg', '.jpg', '.png'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

export interface IntakeDocumentosProps {
  documents: DocumentReceipt[];
  onUpload: (files: File[]) => void;
  uploading: boolean;
  error: string | null;
  onRetry: () => void;
}

export interface FileValidationError {
  fileName: string;
  message: string;
}

const useStyles = makeStyles({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalL,
    padding: tokens.spacingVerticalL,
  },
  dropZone: {
    border: `2px dashed ${tokens.colorNeutralStroke1}`,
    borderRadius: tokens.borderRadiusMedium,
    padding: tokens.spacingVerticalXXL,
    textAlign: 'center' as const,
    cursor: 'pointer',
    transition: 'border-color 0.2s, background-color 0.2s',
  },
  dropZoneActive: {
    border: `2px dashed ${tokens.colorBrandStroke1}`,
    backgroundColor: tokens.colorBrandBackground2,
  },
  dropZoneContent: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: tokens.spacingVerticalS,
  },
  fileInput: {
    display: 'none',
  },
  actions: {
    display: 'flex',
    gap: tokens.spacingHorizontalS,
    alignItems: 'center',
  },
  emptyState: {
    textAlign: 'center' as const,
    padding: tokens.spacingVerticalXXL,
  },
  validationErrors: {
    display: 'flex',
    flexDirection: 'column',
    gap: tokens.spacingVerticalXS,
  },
});

function validateFiles(files: File[]): { valid: File[]; errors: FileValidationError[] } {
  const valid: File[] = [];
  const errors: FileValidationError[] = [];

  for (const file of files) {
    const ext = '.' + file.name.split('.').pop()?.toLowerCase();
    const isFormatValid = ACCEPTED_FORMATS.includes(file.type) || ACCEPTED_EXTENSIONS.includes(ext);

    if (!isFormatValid) {
      errors.push({
        fileName: file.name,
        message: `Formato não suportado. Formatos aceitos: PDF, XML, JPEG, PNG.`,
      });
      continue;
    }

    if (file.size > MAX_FILE_SIZE) {
      errors.push({
        fileName: file.name,
        message: `Arquivo excede o tamanho máximo de 25 MB (${(file.size / (1024 * 1024)).toFixed(1)} MB).`,
      });
      continue;
    }

    valid.push(file);
  }

  return { valid, errors };
}

const documentColumns: ColumnDefinition<DocumentReceipt>[] = [
  { key: 'protocoloUnico', label: 'Protocolo', sortable: true },
  {
    key: 'dataRecebimento',
    label: 'Data Recebimento',
    sortable: true,
    render: (doc) => new Date(doc.dataRecebimento).toLocaleString('pt-BR'),
  },
  { key: 'canalOrigem', label: 'Canal' },
  { key: 'tipoDocumento', label: 'Tipo' },
  { key: 'status', label: 'Status' },
];

export const IntakeDocumentos: React.FC<IntakeDocumentosProps> = ({
  documents,
  onUpload,
  uploading,
  error,
  onRetry,
}) => {
  const styles = useStyles();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [validationErrors, setValidationErrors] = useState<FileValidationError[]>([]);

  const handleFiles = useCallback((files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const { valid, errors } = validateFiles(fileArray);
    setValidationErrors(errors);
    setSelectedFiles(valid);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFiles(e.target.files);
    }
  }, [handleFiles]);

  const handleUploadClick = useCallback(() => {
    if (selectedFiles.length > 0) {
      onUpload(selectedFiles);
      setSelectedFiles([]);
      setValidationErrors([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [selectedFiles, onUpload]);

  const handleBrowseClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  return (
    <div className={styles.container}>
      {/* Error state */}
      {error && (
        <MessageBar intent="error" role="alert">
          <MessageBarBody>{error}</MessageBarBody>
          <MessageBarActions>
            <Button icon={<ArrowClockwiseRegular />} onClick={onRetry}>
              Tentar novamente
            </Button>
          </MessageBarActions>
        </MessageBar>
      )}

      {/* Upload progress */}
      {uploading && (
        <div role="status" aria-label="Upload em andamento">
          <Text>Enviando documentos...</Text>
          <ProgressBar aria-label="Progresso do upload" />
        </div>
      )}

      {/* Drop zone */}
      <div
        className={`${styles.dropZone} ${dragActive ? styles.dropZoneActive : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleBrowseClick}
        role="button"
        tabIndex={0}
        aria-label="Área de upload de documentos. Arraste arquivos ou clique para selecionar."
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleBrowseClick();
          }
        }}
      >
        <div className={styles.dropZoneContent}>
          <ArrowUploadRegular fontSize={32} />
          <Text size={400} weight="semibold">
            Arraste documentos aqui ou clique para selecionar
          </Text>
          <Text size={200}>
            Formatos aceitos: PDF, XML, JPEG, PNG — Máximo 25 MB por arquivo
          </Text>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        className={styles.fileInput}
        accept=".pdf,.xml,.jpeg,.jpg,.png"
        multiple
        onChange={handleFileInputChange}
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Validation errors */}
      {validationErrors.length > 0 && (
        <div className={styles.validationErrors} role="alert">
          {validationErrors.map((err, i) => (
            <MessageBar key={i} intent="error">
              <MessageBarBody>
                <Text weight="semibold">{err.fileName}:</Text> {err.message}
              </MessageBarBody>
            </MessageBar>
          ))}
        </div>
      )}

      {/* Selected files + upload button */}
      <div className={styles.actions}>
        {selectedFiles.length > 0 && (
          <Text>{selectedFiles.length} arquivo(s) selecionado(s)</Text>
        )}
        <Button
          appearance="primary"
          icon={<ArrowUploadRegular />}
          disabled={selectedFiles.length === 0 || uploading}
          onClick={handleUploadClick}
        >
          Enviar
        </Button>
      </div>

      {/* Documents list */}
      {documents.length === 0 && !uploading && !error ? (
        <div className={styles.emptyState}>
          <Text size={400}>Nenhum documento recebido</Text>
        </div>
      ) : (
        documents.length > 0 && (
          <StatusTable<DocumentReceipt>
            columns={documentColumns}
            data={documents}
            getRowKey={(doc) => doc.protocoloUnico}
          />
        )
      )}
    </div>
  );
};
