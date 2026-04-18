import { describe, it, expect, beforeEach } from 'vitest';
import { AuditService } from '../audit-service';
import type { AuditEntryInput, AuditFilters } from '@ap-automation/shared';

describe('AuditService', () => {
  let service: AuditService;

  beforeEach(() => {
    service = new AuditService();
  });

  // ── log() ──────────────────────────────────────────────────────────

  it('should generate a unique id for each entry', async () => {
    const entry: AuditEntryInput = {
      usuarioId: 'user-1',
      tipoAcao: 'documento_recebido',
      protocoloUnico: 'AP-20240101-000001',
    };

    await service.log(entry);
    await service.log(entry);

    const result = await service.query({ page: 1, pageSize: 100 });
    const ids = result.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('should record dataHora with second precision (no milliseconds)', async () => {
    await service.log({
      usuarioId: 'user-1',
      tipoAcao: 'aprovacao',
    });

    const result = await service.query({ page: 1, pageSize: 10 });
    expect(result.items[0].dataHora.getMilliseconds()).toBe(0);
  });

  it('should store all input fields in the entry', async () => {
    const input: AuditEntryInput = {
      usuarioId: 'user-42',
      tipoAcao: 'campo_corrigido',
      protocoloUnico: 'AP-20240601-000010',
      valoresAnteriores: { campo: 'old' },
      valoresPosteriores: { campo: 'new' },
      justificativa: 'Correção manual',
      destaque: false,
    };

    await service.log(input);
    const result = await service.query({ page: 1, pageSize: 10 });
    const entry = result.items[0];

    expect(entry.usuarioId).toBe('user-42');
    expect(entry.tipoAcao).toBe('campo_corrigido');
    expect(entry.protocoloUnico).toBe('AP-20240601-000010');
    expect(entry.valoresAnteriores).toEqual({ campo: 'old' });
    expect(entry.valoresPosteriores).toEqual({ campo: 'new' });
    expect(entry.justificativa).toBe('Correção manual');
    expect(entry.destaque).toBe(false);
  });

  it('should freeze entries so they cannot be mutated', async () => {
    await service.log({
      usuarioId: 'user-1',
      tipoAcao: 'aprovacao',
    });

    const result = await service.query({ page: 1, pageSize: 10 });
    const entry = result.items[0];

    expect(() => {
      (entry as any).usuarioId = 'hacked';
    }).toThrow();
  });

  // ── query() filters ────────────────────────────────────────────────

  it('should filter by usuarioId', async () => {
    await service.log({ usuarioId: 'alice', tipoAcao: 'aprovacao' });
    await service.log({ usuarioId: 'bob', tipoAcao: 'rejeicao' });

    const result = await service.query({
      usuarioId: 'bob',
      page: 1,
      pageSize: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].usuarioId).toBe('bob');
  });

  it('should filter by tipoAcao', async () => {
    await service.log({ usuarioId: 'u1', tipoAcao: 'aprovacao' });
    await service.log({ usuarioId: 'u2', tipoAcao: 'rejeicao' });
    await service.log({ usuarioId: 'u3', tipoAcao: 'aprovacao' });

    const result = await service.query({
      tipoAcao: 'aprovacao',
      page: 1,
      pageSize: 10,
    });

    expect(result.items).toHaveLength(2);
  });

  it('should filter by protocoloUnico', async () => {
    await service.log({
      usuarioId: 'u1',
      tipoAcao: 'documento_recebido',
      protocoloUnico: 'AP-20240101-000001',
    });
    await service.log({
      usuarioId: 'u1',
      tipoAcao: 'aprovacao',
      protocoloUnico: 'AP-20240101-000002',
    });

    const result = await service.query({
      protocoloUnico: 'AP-20240101-000001',
      page: 1,
      pageSize: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].protocoloUnico).toBe('AP-20240101-000001');
  });

  it('should filter by periodo (date range)', async () => {
    const svc = new AuditService();

    // Log three entries — we'll query by the dataHora that gets assigned
    await svc.log({ usuarioId: 'u1', tipoAcao: 'aprovacao' });

    const all = await svc.query({ page: 1, pageSize: 100 });
    const entryTime = all.items[0].dataHora;

    const inicio = new Date(entryTime.getTime() - 1000);
    const fim = new Date(entryTime.getTime() + 1000);

    const result = await svc.query({
      periodo: { inicio, fim },
      page: 1,
      pageSize: 10,
    });

    expect(result.items).toHaveLength(1);

    // Out-of-range query
    const future = new Date(entryTime.getTime() + 100_000);
    const farFuture = new Date(entryTime.getTime() + 200_000);
    const empty = await svc.query({
      periodo: { inicio: future, fim: farFuture },
      page: 1,
      pageSize: 10,
    });

    expect(empty.items).toHaveLength(0);
  });

  // ── query() pagination ─────────────────────────────────────────────

  it('should paginate results correctly', async () => {
    for (let i = 0; i < 25; i++) {
      await service.log({ usuarioId: `u-${i}`, tipoAcao: 'aprovacao' });
    }

    const page1 = await service.query({ page: 1, pageSize: 10 });
    expect(page1.items).toHaveLength(10);
    expect(page1.total).toBe(25);
    expect(page1.page).toBe(1);
    expect(page1.pageSize).toBe(10);
    expect(page1.totalPages).toBe(3);

    const page3 = await service.query({ page: 3, pageSize: 10 });
    expect(page3.items).toHaveLength(5);
  });

  it('should return empty items for a page beyond total', async () => {
    await service.log({ usuarioId: 'u1', tipoAcao: 'aprovacao' });

    const result = await service.query({ page: 5, pageSize: 10 });
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(1);
  });

  // ── immutability ───────────────────────────────────────────────────

  it('should NOT expose update or delete methods', () => {
    const proto = Object.getOwnPropertyNames(
      Object.getPrototypeOf(service),
    );
    expect(proto).not.toContain('update');
    expect(proto).not.toContain('delete');
    expect(proto).not.toContain('remove');
    expect(proto).not.toContain('clear');
  });

  it('should only grow — count never decreases', async () => {
    expect(service.count).toBe(0);

    await service.log({ usuarioId: 'u1', tipoAcao: 'aprovacao' });
    expect(service.count).toBe(1);

    await service.log({ usuarioId: 'u2', tipoAcao: 'rejeicao' });
    expect(service.count).toBe(2);
  });
});
