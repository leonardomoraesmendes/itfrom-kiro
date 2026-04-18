import { render, screen, fireEvent } from '@testing-library/react';
import { FluentProvider, webLightTheme } from '@fluentui/react-components';
import { describe, it, expect, vi } from 'vitest';
import { IntakeDocumentos } from '../IntakeDocumentos';
import type { IntakeDocumentosProps } from '../IntakeDocumentos';
import type { DocumentReceipt } from '@ap-automation/shared';

function wrap(ui: React.ReactElement) {
  return render(<FluentProvider theme={webLightTheme}>{ui}</FluentProvider>);
}

const sampleDoc: DocumentReceipt = {
  protocoloUnico: 'AP-20240101-000001',
  dataRecebimento: new Date('2024-01-15T10:30:00Z'),
  canalOrigem: 'upload',
  tipoDocumento: 'nota_fiscal',
  status: 'recebido',
};

const defaultProps: IntakeDocumentosProps = {
  documents: [],
  onUpload: vi.fn(),
  uploading: false,
  error: null,
  onRetry: vi.fn(),
};

function createFile(name: string, size: number, type: string): File {
  const buffer = new ArrayBuffer(size);
  return new File([buffer], name, { type });
}

describe('IntakeDocumentos', () => {
  it('renders empty state when no documents', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    expect(screen.getByText('Nenhum documento recebido')).toBeInTheDocument();
  });

  it('renders document list when documents are provided', () => {
    wrap(<IntakeDocumentos {...defaultProps} documents={[sampleDoc]} />);
    expect(screen.getByText('AP-20240101-000001')).toBeInTheDocument();
    expect(screen.getByText('upload')).toBeInTheDocument();
    expect(screen.getByText('nota_fiscal')).toBeInTheDocument();
  });

  it('renders error state with retry button', () => {
    const onRetry = vi.fn();
    wrap(<IntakeDocumentos {...defaultProps} error="Falha no envio" onRetry={onRetry} />);
    expect(screen.getByText('Falha no envio')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Tentar novamente'));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('renders loading state with progress bar', () => {
    wrap(<IntakeDocumentos {...defaultProps} uploading={true} />);
    expect(screen.getByText('Enviando documentos...')).toBeInTheDocument();
    expect(screen.getByLabelText('Progresso do upload')).toBeInTheDocument();
  });

  it('renders upload drop zone', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    expect(
      screen.getByLabelText('Área de upload de documentos. Arraste arquivos ou clique para selecionar.')
    ).toBeInTheDocument();
    expect(screen.getByText(/Arraste documentos aqui/)).toBeInTheDocument();
  });

  it('disables upload button when no files selected', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const button = screen.getByText('Enviar');
    expect(button.closest('button')).toBeDisabled();
  });

  it('disables upload button when uploading', () => {
    wrap(<IntakeDocumentos {...defaultProps} uploading={true} />);
    const button = screen.getByText('Enviar');
    expect(button.closest('button')).toBeDisabled();
  });

  it('shows validation error for unsupported format', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const badFile = createFile('doc.exe', 1024, 'application/x-msdownload');
    fireEvent.change(input, { target: { files: [badFile] } });

    expect(screen.getByText(/Formato não suportado/)).toBeInTheDocument();
  });

  it('shows validation error for oversized file', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const bigFile = createFile('big.pdf', 30 * 1024 * 1024, 'application/pdf');
    fireEvent.change(input, { target: { files: [bigFile] } });

    expect(screen.getByText(/excede o tamanho máximo/)).toBeInTheDocument();
  });

  it('accepts valid PDF file and enables upload', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const validFile = createFile('invoice.pdf', 1024, 'application/pdf');
    fireEvent.change(input, { target: { files: [validFile] } });

    expect(screen.getByText('1 arquivo(s) selecionado(s)')).toBeInTheDocument();
    const button = screen.getByText('Enviar');
    expect(button.closest('button')).not.toBeDisabled();
  });

  it('calls onUpload with valid files when upload button clicked', () => {
    const onUpload = vi.fn();
    wrap(<IntakeDocumentos {...defaultProps} onUpload={onUpload} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const validFile = createFile('invoice.pdf', 1024, 'application/pdf');
    fireEvent.change(input, { target: { files: [validFile] } });
    fireEvent.click(screen.getByText('Enviar'));

    expect(onUpload).toHaveBeenCalledOnce();
    expect(onUpload).toHaveBeenCalledWith([validFile]);
  });

  it('handles batch upload with mixed valid and invalid files', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const validPdf = createFile('ok.pdf', 1024, 'application/pdf');
    const invalidExe = createFile('bad.exe', 1024, 'application/x-msdownload');
    const validPng = createFile('img.png', 2048, 'image/png');

    fireEvent.change(input, { target: { files: [validPdf, invalidExe, validPng] } });

    expect(screen.getByText('2 arquivo(s) selecionado(s)')).toBeInTheDocument();
    expect(screen.getByText(/Formato não suportado/)).toBeInTheDocument();
  });

  it('accepts XML files', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const xmlFile = createFile('nfe.xml', 512, 'text/xml');
    fireEvent.change(input, { target: { files: [xmlFile] } });

    expect(screen.getByText('1 arquivo(s) selecionado(s)')).toBeInTheDocument();
    expect(screen.queryByText(/Formato não suportado/)).not.toBeInTheDocument();
  });

  it('accepts JPEG files', () => {
    wrap(<IntakeDocumentos {...defaultProps} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;

    const jpegFile = createFile('photo.jpeg', 2048, 'image/jpeg');
    fireEvent.change(input, { target: { files: [jpegFile] } });

    expect(screen.getByText('1 arquivo(s) selecionado(s)')).toBeInTheDocument();
  });
});
