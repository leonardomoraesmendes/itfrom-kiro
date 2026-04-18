import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const documentsRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { documentService } = opts.container;

  fastify.post('/documents', {
    schema: {
      description: 'Receber um documento fiscal',
      tags: ['Documentos'],
      body: {
        type: 'object',
        required: ['fileName', 'fileSize', 'fileType', 'channel'],
        properties: {
          fileName: { type: 'string' },
          fileSize: { type: 'number' },
          fileType: { type: 'string' },
          channel: { type: 'string', enum: ['email', 'upload', 'api'] },
        },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            protocoloUnico: { type: 'string' },
            dataRecebimento: { type: 'string' },
            canalOrigem: { type: 'string' },
            tipoDocumento: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    const { fileName, fileSize, fileType, channel } = request.body as {
      fileName: string;
      fileSize: number;
      fileType: string;
      channel: 'email' | 'upload' | 'api';
    };
    const file = { name: fileName, size: fileSize, type: fileType, buffer: Buffer.alloc(0) };
    return documentService.receiveDocument(file, channel);
  });

  fastify.post('/documents/batch', {
    schema: {
      description: 'Receber documentos fiscais em lote',
      tags: ['Documentos'],
      body: {
        type: 'object',
        required: ['files', 'channel'],
        properties: {
          files: {
            type: 'array',
            items: {
              type: 'object',
              required: ['fileName', 'fileSize', 'fileType'],
              properties: {
                fileName: { type: 'string' },
                fileSize: { type: 'number' },
                fileType: { type: 'string' },
              },
            },
          },
          channel: { type: 'string', enum: ['email', 'upload', 'api'] },
        },
      },
    },
  }, async (request) => {
    const { files, channel } = request.body as {
      files: Array<{ fileName: string; fileSize: number; fileType: string }>;
      channel: 'email' | 'upload' | 'api';
    };
    const fileInputs = files.map((f) => ({
      name: f.fileName,
      size: f.fileSize,
      type: f.fileType,
      buffer: Buffer.alloc(0),
    }));
    return documentService.receiveBatch(fileInputs, channel);
  });

  fastify.get('/documents/:id', {
    schema: {
      description: 'Obter documento fiscal por protocolo único',
      tags: ['Documentos'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return documentService.getDocument(id);
  });

  fastify.get('/documents', {
    schema: {
      description: 'Listar documentos fiscais com filtros e paginação',
      tags: ['Documentos'],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string' },
          fornecedor: { type: 'string' },
          page: { type: 'number', default: 1 },
          pageSize: { type: 'number', default: 20 },
        },
      },
    },
  }, async (request) => {
    const query = request.query as {
      status?: string;
      fornecedor?: string;
      page?: number;
      pageSize?: number;
    };
    return documentService.listDocuments({
      status: query.status as any,
      fornecedor: query.fornecedor,
      page: query.page ?? 1,
      pageSize: query.pageSize ?? 20,
    });
  });
};
