// Schema type removed to avoid ajv version incompatibility in strict tsc builds

/**
 * Representação JSON-serializada do DocumentoFiscal.
 * Datas são strings no formato "YYYY-MM-DD" (ISO date).
 */
export interface DocumentoFiscalJSON {
  protocoloUnico: string;
  cnpjEmitente: string;
  cnpjDestinatario: string;
  numeroDocumento: string;
  dataEmissao: string;
  dataVencimento: string;
  valorTotal: number;
  itensLinha: ItemLinhaJSON[];
  impostos: ImpostoJSON[];
  tipoDocumento: 'nota_fiscal' | 'boleto' | 'fatura';
  canalOrigem: 'email' | 'upload' | 'api';
  status:
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
  indiceConfiancaPorCampo: Record<string, number>;
  dataRecebimento: string;
  analistaResponsavel?: string;
  aprovadorDesignado?: string;
  erpTransactionId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ItemLinhaJSON {
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  codigoNCM?: string;
}

export interface ImpostoJSON {
  tipo: string;
  baseCalculo: number;
  aliquota: number;
  valor: number;
}

export const documentoFiscalSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: [
    'protocoloUnico',
    'cnpjEmitente',
    'cnpjDestinatario',
    'numeroDocumento',
    'dataEmissao',
    'dataVencimento',
    'valorTotal',
    'itensLinha',
    'impostos',
    'tipoDocumento',
    'canalOrigem',
    'status',
    'indiceConfiancaPorCampo',
    'dataRecebimento',
    'createdAt',
    'updatedAt',
  ],
  additionalProperties: false,
  properties: {
    protocoloUnico: {
      type: 'string',
      pattern: '^AP-\\d{8}-\\d{6}$',
    },
    cnpjEmitente: {
      type: 'string',
      pattern: '^\\d{14}$',
    },
    cnpjDestinatario: {
      type: 'string',
      pattern: '^\\d{14}$',
    },
    numeroDocumento: {
      type: 'string',
      minLength: 1,
    },
    dataEmissao: {
      type: 'string',
      format: 'date',
    },
    dataVencimento: {
      type: 'string',
      format: 'date',
    },
    valorTotal: {
      type: 'integer',
      minimum: 0,
    },
    itensLinha: {
      type: 'array',
      items: {
        type: 'object',
        required: ['descricao', 'quantidade', 'valorUnitario', 'valorTotal'],
        additionalProperties: false,
        properties: {
          descricao: { type: 'string' },
          quantidade: { type: 'number', minimum: 0 },
          valorUnitario: { type: 'integer', minimum: 0 },
          valorTotal: { type: 'integer', minimum: 0 },
          codigoNCM: { type: 'string', nullable: true },
        },
      },
    },
    impostos: {
      type: 'array',
      items: {
        type: 'object',
        required: ['tipo', 'baseCalculo', 'aliquota', 'valor'],
        additionalProperties: false,
        properties: {
          tipo: { type: 'string' },
          baseCalculo: { type: 'integer', minimum: 0 },
          aliquota: { type: 'number', minimum: 0, maximum: 100 },
          valor: { type: 'integer', minimum: 0 },
        },
      },
    },
    tipoDocumento: {
      type: 'string',
      enum: ['nota_fiscal', 'boleto', 'fatura'],
    },
    canalOrigem: {
      type: 'string',
      enum: ['email', 'upload', 'api'],
    },
    status: {
      type: 'string',
      enum: [
        'recebido',
        'em_extracao',
        'aguardando_revisao',
        'em_validacao',
        'aguardando_aprovacao',
        'aprovado',
        'rejeitado',
        'devolvido',
        'registrado_erp',
        'erro_integracao',
        'pago',
        'cancelado',
      ],
    },
    indiceConfiancaPorCampo: {
      type: 'object',
      required: [],
      additionalProperties: { type: 'number' },
    },
    dataRecebimento: {
      type: 'string',
      format: 'date',
    },
    analistaResponsavel: {
      type: 'string',
      nullable: true,
    },
    aprovadorDesignado: {
      type: 'string',
      nullable: true,
    },
    erpTransactionId: {
      type: 'string',
      nullable: true,
    },
    createdAt: {
      type: 'string',
      format: 'date',
    },
    updatedAt: {
      type: 'string',
      format: 'date',
    },
  },
};
