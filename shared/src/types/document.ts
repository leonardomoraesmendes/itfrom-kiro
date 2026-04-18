// Tipos relacionados a documentos fiscais

/**
 * Simple file input interface for Node.js context.
 * Replaces the browser File API for backend usage.
 */
export interface FileInput {
  name: string;
  size: number;
  type: string; // MIME type
  buffer: Buffer;
}

export type DocumentStatus =
  | 'recebido'
  | 'em_extracao'
  | 'aguardando_revisao'
  | 'em_validacao'
  | 'aguardando_aprovacao'
  | 'aprovado'
  | 'rejeitado'
  | 'devolvido'
  | 'registrado_erp'
  | 'erro_integracao'
  | 'pago'
  | 'cancelado';

export type ProcessStage =
  | 'intake'
  | 'captura'
  | 'validacao'
  | 'aprovacao'
  | 'integracao_erp'
  | 'concluido';

export type DocumentChannel = 'email' | 'upload' | 'api';

export type DocumentType = 'nota_fiscal' | 'boleto' | 'fatura';

export interface ItemLinha {
  descricao: string;
  quantidade: number;
  valorUnitario: number;  // centavos
  valorTotal: number;     // centavos
  codigoNCM?: string;
}

export interface Imposto {
  tipo: string;           // ICMS, IPI, PIS, COFINS, ISS, etc.
  baseCalculo: number;    // centavos
  aliquota: number;       // percentual
  valor: number;          // centavos
}

export interface DocumentoFiscal {
  protocoloUnico: string;           // Identificador único sequencial
  cnpjEmitente: string;             // CNPJ do fornecedor
  cnpjDestinatario: string;         // CNPJ da empresa
  numeroDocumento: string;          // Número da NF/boleto/fatura
  dataEmissao: Date;
  dataVencimento: Date;
  valorTotal: number;               // Valor em centavos (inteiro)
  itensLinha: ItemLinha[];
  impostos: Imposto[];
  tipoDocumento: DocumentType;
  canalOrigem: DocumentChannel;
  status: DocumentStatus;
  indiceConfiancaPorCampo: Record<string, number>; // campo -> 0-100

  // Metadados
  dataRecebimento: Date;
  analistaResponsavel?: string;
  aprovadorDesignado?: string;
  erpTransactionId?: string;

  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentReceipt {
  protocoloUnico: string;
  dataRecebimento: Date;
  canalOrigem: DocumentChannel;
  tipoDocumento: DocumentType;
  status: DocumentStatus;
}

export interface DocumentFilters {
  status?: DocumentStatus;
  fornecedor?: string;
  dataVencimentoInicio?: Date;
  dataVencimentoFim?: Date;
  faixaValorMin?: number;
  faixaValorMax?: number;
  etapa?: ProcessStage;
  page: number;
  pageSize: number;
}
