import type { FastifyPluginAsync } from 'fastify';
import type { ServiceContainer } from '../container';

export const ocrRoutes: FastifyPluginAsync<{ container: ServiceContainer }> = async (
  fastify,
  opts,
) => {
  const { ocrService } = opts.container;

  fastify.post('/ocr/extract/:id', {
    schema: {
      description: 'Iniciar extração OCR/IDP para um documento',
      tags: ['OCR'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    return ocrService.extractData(id, Buffer.alloc(0));
  });

  fastify.get('/ocr/status/:id', {
    schema: {
      description: 'Consultar status de extração OCR/IDP',
      tags: ['OCR'],
      params: {
        type: 'object',
        required: ['id'],
        properties: { id: { type: 'string' } },
      },
      response: {
        200: {
          type: 'object',
          properties: {
            protocoloUnico: { type: 'string' },
            status: { type: 'string' },
          },
        },
      },
    },
  }, async (request) => {
    const { id } = request.params as { id: string };
    const status = await ocrService.getExtractionStatus(id);
    return { protocoloUnico: id, status };
  });
};
