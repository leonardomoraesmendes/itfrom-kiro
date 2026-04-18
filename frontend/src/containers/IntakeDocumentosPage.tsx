import { useEffect, useState, useCallback } from 'react';
import { useDocumentsStore } from '../stores/documents';
import { IntakeDocumentos } from '../pages/IntakeDocumentos';
import { apiClient } from '../api/client';

interface ReceiptItem {
  protocoloUnico: string;
  dataRecebimento: string;
  canalOrigem: string;
  tipoDocumento: string;
  status: string;
}

export const IntakeDocumentosPage: React.FC = () => {
  const { loading, error } = useDocumentsStore();
  const [receipts, setReceipts] = useState<ReceiptItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const fetchReceipts = useCallback(async () => {
    try {
      const result = await apiClient.get<{ items: ReceiptItem[] }>('/documents', { page: '1', pageSize: '50' });
      setReceipts(result.items ?? []);
    } catch {
      // ignore fetch errors on mount
    }
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleUpload = useCallback(async (files: File[]) => {
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of files) {
        await apiClient.post('/documents', {
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          channel: 'upload',
        });
      }
      await fetchReceipts();
    } catch (err) {
      setUploadError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }, [fetchReceipts]);

  return (
    <IntakeDocumentos
      documents={receipts as any}
      onUpload={handleUpload}
      uploading={uploading}
      error={uploadError}
      onRetry={fetchReceipts}
    />
  );
};
