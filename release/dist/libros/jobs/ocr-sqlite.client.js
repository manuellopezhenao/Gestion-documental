"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OcrSqliteClient = void 0;
const node_sqlite_1 = require("node:sqlite");
class OcrSqliteClient {
    constructor(dbPath) {
        this.dbPath = dbPath;
    }
    maxIdParaPdf(pdfOrigenAbsoluto) {
        const db = new node_sqlite_1.DatabaseSync(this.dbPath, { readOnly: true });
        try {
            const row = db
                .prepare('SELECT COALESCE(MAX(id), 0) AS maxId FROM documentos WHERE pdf_origen = ?')
                .get(pdfOrigenAbsoluto);
            return row.maxId;
        }
        finally {
            db.close();
        }
    }
    documentosNuevos(pdfOrigenAbsoluto, despuesDeId) {
        const db = new node_sqlite_1.DatabaseSync(this.dbPath, { readOnly: true });
        try {
            return db
                .prepare('SELECT * FROM documentos WHERE pdf_origen = ? AND id > ? ORDER BY id ASC')
                .all(pdfOrigenAbsoluto, despuesDeId);
        }
        finally {
            db.close();
        }
    }
    persona(id) {
        if (id === null)
            return null;
        const db = new node_sqlite_1.DatabaseSync(this.dbPath, { readOnly: true });
        try {
            return db.prepare('SELECT * FROM personas WHERE id = ?').get(id) ?? null;
        }
        finally {
            db.close();
        }
    }
}
exports.OcrSqliteClient = OcrSqliteClient;
//# sourceMappingURL=ocr-sqlite.client.js.map