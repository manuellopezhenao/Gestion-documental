import { DatabaseSync } from 'node:sqlite';

// Lee (solo lectura) la base sqlite que escribe split_consecutivos.py
// (split_facturas/documentos.db). El script Python sigue siendo el dueno de
// ese archivo - este cliente nunca escribe ahi, solo importa filas nuevas
// hacia el schema de Prisma despues de correr el proceso (ver
// procesar-libro.job.ts y PLAN_API.md seccion 3, decision Node/Python).
export interface FilaDocumentoOcr {
  id: number;
  consecutivo: string;
  persona_id: number | null;
  fecha: string | null; // "AAAA/MM/DD"
  periodo_libro: string | null; // "AAAA/MM"
  revisar: number; // 0 | 1
  pagina_inicio: number;
  pagina_fin: number;
  archivo: string; // path absoluto
  pdf_origen: string; // path absoluto
  procesado_en: string;
}

export interface FilaPersonaOcr {
  id: number;
  cedula: string | null;
  nombre: string | null;
}

export class OcrSqliteClient {
  constructor(private readonly dbPath: string) {}

  maxIdParaPdf(pdfOrigenAbsoluto: string): number {
    const db = new DatabaseSync(this.dbPath, { readOnly: true });
    try {
      const row = db
        .prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM documentos WHERE pdf_origen = ?')
        .get(pdfOrigenAbsoluto) as { maxId: number };
      return row.maxId;
    } finally {
      db.close();
    }
  }

  documentosNuevos(pdfOrigenAbsoluto: string, despuesDeId: number): FilaDocumentoOcr[] {
    const db = new DatabaseSync(this.dbPath, { readOnly: true });
    try {
      return db
        .prepare('SELECT * FROM documentos WHERE pdf_origen = ? AND id > ? ORDER BY id ASC')
        .all(pdfOrigenAbsoluto, despuesDeId) as unknown as FilaDocumentoOcr[];
    } finally {
      db.close();
    }
  }

  persona(id: number | null): FilaPersonaOcr | null {
    if (id === null) return null;
    const db = new DatabaseSync(this.dbPath, { readOnly: true });
    try {
      return (db.prepare('SELECT * FROM personas WHERE id = ?').get(id) as FilaPersonaOcr | undefined) ?? null;
    } finally {
      db.close();
    }
  }
}
