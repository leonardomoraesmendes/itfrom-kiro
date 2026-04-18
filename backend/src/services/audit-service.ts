import type {
  IAuditService,
  AuditEntry,
  AuditEntryInput,
  AuditFilters,
  PaginatedResult,
} from '@ap-automation/shared';

/**
 * In-memory append-only audit service.
 *
 * Mimics a PostgreSQL append-only table:
 * - INSERT only (via `log`)
 * - No UPDATE or DELETE operations exposed
 * - The internal store is a frozen-on-write array
 */
export class AuditService implements IAuditService {
  private readonly store: AuditEntry[] = [];
  private counter = 0;

  async log(entry: AuditEntryInput): Promise<void> {
    this.counter++;
    const now = new Date();
    // Truncate to second precision
    now.setMilliseconds(0);

    const record: AuditEntry = {
      ...entry,
      id: `AUDIT-${String(this.counter).padStart(8, '0')}`,
      dataHora: now,
    };

    // Freeze the record so it cannot be mutated after insertion
    Object.freeze(record);
    this.store.push(record);
  }

  async query(filters: AuditFilters): Promise<PaginatedResult<AuditEntry>> {
    let results = this.store.slice(); // shallow copy — records are frozen

    // Filter by period
    if (filters.periodo) {
      const { inicio, fim } = filters.periodo;
      results = results.filter(
        (e) => e.dataHora >= inicio && e.dataHora <= fim,
      );
    }

    // Filter by userId
    if (filters.usuarioId) {
      results = results.filter((e) => e.usuarioId === filters.usuarioId);
    }

    // Filter by action type
    if (filters.tipoAcao) {
      results = results.filter((e) => e.tipoAcao === filters.tipoAcao);
    }

    // Filter by protocoloUnico
    if (filters.protocoloUnico) {
      results = results.filter(
        (e) => e.protocoloUnico === filters.protocoloUnico,
      );
    }

    const total = results.length;
    const page = filters.page;
    const pageSize = filters.pageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const start = (page - 1) * pageSize;
    const items = results.slice(start, start + pageSize);

    return { items, total, page, pageSize, totalPages };
  }

  /** Expose count for testing — read-only */
  get count(): number {
    return this.store.length;
  }
}
