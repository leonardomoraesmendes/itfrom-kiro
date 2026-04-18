import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { AuditService } from '../audit-service';
import type { AuditEntryInput, AuditActionType } from '@ap-automation/shared';

// --- Arbitraries ---

const arbAuditActionType: fc.Arbitrary<AuditActionType> = fc.constantFrom(
  'documento_recebido',
  'extracao_concluida',
  'campo_corrigido',
  'validacao_executada',
  'duplicata_liberada',
  'duplicata_rejeitada',
  'aprovacao',
  'rejeicao',
  'devolucao',
  'override_validacao',
  'registro_erp',
  'reprocessamento_erp',
  'alteracao_configuracao',
  'violacao_sod_bloqueada',
);

const arbAuditEntryInput: fc.Arbitrary<AuditEntryInput> = fc.record({
  usuarioId: fc.string({ minLength: 1, maxLength: 30 }),
  tipoAcao: arbAuditActionType,
  protocoloUnico: fc.option(
    fc.stringMatching(/^AP-\d{8}-\d{6}$/),
    { nil: undefined },
  ),
  valoresAnteriores: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 })),
    { nil: undefined },
  ),
  valoresPosteriores: fc.option(
    fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ maxLength: 20 })),
    { nil: undefined },
  ),
  justificativa: fc.option(fc.string({ minLength: 1, maxLength: 100 }), { nil: undefined }),
  destaque: fc.option(fc.boolean(), { nil: undefined }),
});

// --- Property Tests ---

describe('Propriedade 5: Imutabilidade da trilha de auditoria', () => {
  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * Para qualquer sequência de operações de log, o número de registros
   * só pode crescer (nunca diminuir).
   */
  it('o número de registros só pode crescer após cada operação de log', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbAuditEntryInput, { minLength: 1, maxLength: 30 }),
        async (entries) => {
          const service = new AuditService();
          let previousCount = 0;

          for (const entry of entries) {
            await service.log(entry);
            const currentCount = service.count;

            // Count must strictly increase by 1 after each log
            expect(currentCount).toBe(previousCount + 1);
            previousCount = currentCount;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * Nenhuma operação de log deve alterar registros existentes.
   * Após uma sequência de operações, todos os registros previamente
   * armazenados devem permanecer inalterados (mesmo id, dataHora e campos).
   */
  it('registros existentes permanecem inalterados após novas inserções', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbAuditEntryInput, { minLength: 2, maxLength: 30 }),
        async (entries) => {
          const service = new AuditService();
          const snapshots: Array<{
            id: string;
            dataHora: number;
            usuarioId: string;
            tipoAcao: AuditActionType;
            protocoloUnico?: string;
            justificativa?: string;
            destaque?: boolean;
          }> = [];

          for (const entry of entries) {
            await service.log(entry);

            // Query all entries so far
            const result = await service.query({ page: 1, pageSize: 1000 });

            // Verify all previously snapshotted entries are unchanged
            for (let i = 0; i < snapshots.length; i++) {
              const stored = result.items[i];
              const snap = snapshots[i];

              expect(stored.id).toBe(snap.id);
              expect(stored.dataHora.getTime()).toBe(snap.dataHora);
              expect(stored.usuarioId).toBe(snap.usuarioId);
              expect(stored.tipoAcao).toBe(snap.tipoAcao);
              expect(stored.protocoloUnico).toBe(snap.protocoloUnico);
              expect(stored.justificativa).toBe(snap.justificativa);
              expect(stored.destaque).toBe(snap.destaque);
            }

            // Snapshot the newly added entry
            const newest = result.items[result.items.length - 1];
            snapshots.push({
              id: newest.id,
              dataHora: newest.dataHora.getTime(),
              usuarioId: newest.usuarioId,
              tipoAcao: newest.tipoAcao,
              protocoloUnico: newest.protocoloUnico,
              justificativa: newest.justificativa,
              destaque: newest.destaque,
            });
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  /**
   * **Validates: Requirements 8.1, 8.2**
   *
   * Consultar a trilha de auditoria retorna entradas que correspondem
   * ao que foi registrado — os campos de entrada são preservados.
   */
  it('entradas consultadas correspondem ao que foi registrado', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(arbAuditEntryInput, { minLength: 1, maxLength: 20 }),
        async (entries) => {
          const service = new AuditService();

          for (const entry of entries) {
            await service.log(entry);
          }

          const result = await service.query({ page: 1, pageSize: 1000 });
          expect(result.items).toHaveLength(entries.length);

          for (let i = 0; i < entries.length; i++) {
            const input = entries[i];
            const stored = result.items[i];

            // Input fields must be preserved
            expect(stored.usuarioId).toBe(input.usuarioId);
            expect(stored.tipoAcao).toBe(input.tipoAcao);
            expect(stored.protocoloUnico).toBe(input.protocoloUnico);
            expect(stored.justificativa).toBe(input.justificativa);
            expect(stored.destaque).toBe(input.destaque);

            // System-assigned fields must exist
            expect(stored.id).toBeDefined();
            expect(stored.dataHora).toBeInstanceOf(Date);
            expect(stored.dataHora.getMilliseconds()).toBe(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
