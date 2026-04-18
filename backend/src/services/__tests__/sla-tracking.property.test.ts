import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { QueueService } from '../queue-service';
import type { SLAConfig, ProcessStage } from '@ap-automation/shared';

// --- Arbitraries ---

const allStages: ProcessStage[] = [
  'intake',
  'captura',
  'validacao',
  'aprovacao',
  'integracao_erp',
  'concluido',
];

/** Pick a random stage that has SLA configured (excludes 'concluido'). */
const arbStageWithSla: fc.Arbitrary<ProcessStage> = fc.constantFrom<ProcessStage>(
  'intake',
  'captura',
  'validacao',
  'aprovacao',
  'integracao_erp',
);

/** Positive SLA max time in minutes (1–10080, i.e. up to 7 days). */
const arbSlaMaximo: fc.Arbitrary<number> = fc.integer({ min: 1, max: 10080 });

// --- Helpers ---

/**
 * Build a QueueService with a single SLA config for the given stage,
 * using the provided tempoMaximoMinutos and a fixed 80% alert threshold.
 */
function buildService(etapa: ProcessStage, tempoMaximoMinutos: number): QueueService {
  const configs: SLAConfig[] = allStages
    .filter((s) => s !== 'concluido')
    .map((s) => ({
      etapa: s,
      tempoMaximoMinutos: s === etapa ? tempoMaximoMinutos : 9999,
      percentualAlerta: 0.8,
    }));
  return new QueueService(configs);
}

// --- Property Tests ---

describe('Propriedade 4: Rastreamento de SLA com limiar de 80%', () => {
  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * Para qualquer item na fila, se tempoDecorrido / slaMaximo < 0.8,
   * então slaStatus deve ser 'dentro_prazo'.
   */
  it('retorna dentro_prazo quando ratio < 0.8', () => {
    fc.assert(
      fc.property(
        arbStageWithSla,
        arbSlaMaximo,
        fc.double({ min: 0, max: 0.7999, noNaN: true }),
        (etapa, slaMaximo, fracao) => {
          const tempoDecorrido = Math.floor(slaMaximo * fracao);
          // Ensure ratio is strictly < 0.8
          fc.pre(tempoDecorrido / slaMaximo < 0.8);

          const service = buildService(etapa, slaMaximo);
          const status = service.calculateSlaStatus(tempoDecorrido, etapa);

          expect(status).toBe('dentro_prazo');
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * Para qualquer item na fila, se tempoDecorrido / slaMaximo >= 0.8
   * e tempoDecorrido / slaMaximo <= 1.0, então slaStatus deve ser 'alerta'.
   */
  it('retorna alerta quando 0.8 <= ratio <= 1.0', () => {
    fc.assert(
      fc.property(
        arbStageWithSla,
        arbSlaMaximo,
        fc.double({ min: 0.8, max: 1.0, noNaN: true }),
        (etapa, slaMaximo, fracao) => {
          // Use ceiling to ensure we don't undershoot the 0.8 boundary
          const tempoDecorrido = Math.ceil(slaMaximo * fracao);
          const ratio = tempoDecorrido / slaMaximo;
          // Ensure ratio is within [0.8, 1.0]
          fc.pre(ratio >= 0.8 && ratio <= 1.0);

          const service = buildService(etapa, slaMaximo);
          const status = service.calculateSlaStatus(tempoDecorrido, etapa);

          expect(status).toBe('alerta');
        },
      ),
      { numRuns: 300 },
    );
  });

  /**
   * **Validates: Requirements 5.3, 5.4**
   *
   * Para qualquer item na fila, se tempoDecorrido / slaMaximo > 1.0,
   * então slaStatus deve ser 'vencido'.
   */
  it('retorna vencido quando ratio > 1.0', () => {
    fc.assert(
      fc.property(
        arbStageWithSla,
        arbSlaMaximo,
        fc.double({ min: 1.001, max: 5.0, noNaN: true }),
        (etapa, slaMaximo, fracao) => {
          const tempoDecorrido = Math.ceil(slaMaximo * fracao);
          // Ensure ratio is strictly > 1.0
          fc.pre(tempoDecorrido / slaMaximo > 1.0);

          const service = buildService(etapa, slaMaximo);
          const status = service.calculateSlaStatus(tempoDecorrido, etapa);

          expect(status).toBe('vencido');
        },
      ),
      { numRuns: 300 },
    );
  });
});
