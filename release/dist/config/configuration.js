"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
function detectarPythonBin() {
    const candidatos = ['python3', 'python'];
    for (const candidato of candidatos) {
        const resultado = (0, child_process_1.spawnSync)(candidato, ['--version']);
        if (!resultado.error)
            return candidato;
    }
    return 'python';
}
exports.default = () => ({
    app: {
        port: parseInt(process.env.PORT ?? '3000', 10),
        storageBackend: process.env.STORAGE_BACKEND ?? 'filesystem',
        storagePath: process.env.STORAGE_PATH ?? './output',
        jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-cambiar',
        jwtExpiraMin: parseInt(process.env.JWT_EXPIRA_MIN ?? '60', 10),
        pythonBin: process.env.PYTHON_BIN ?? detectarPythonBin(),
        ocrScriptPath: process.env.OCR_SCRIPT_PATH ?? '../split_facturas/split_consecutivos.py',
        ocrDbPath: process.env.OCR_DB_PATH ?? '../split_facturas/documentos.db',
    },
});
//# sourceMappingURL=configuration.js.map