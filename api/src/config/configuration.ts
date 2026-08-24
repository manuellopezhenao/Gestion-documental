export interface AppConfig {
  port: number;
  storageBackend: string;
  storagePath: string;
  jwtSecret: string;
  jwtExpiraMin: number;
  pythonBin: string;
  ocrScriptPath: string;
  ocrDbPath: string;
}

export default (): { app: AppConfig } => ({
  app: {
    port: parseInt(process.env.PORT ?? '3000', 10),
    storageBackend: process.env.STORAGE_BACKEND ?? 'filesystem',
    storagePath: process.env.STORAGE_PATH ?? './output',
    jwtSecret: process.env.JWT_SECRET ?? 'dev-secret-cambiar',
    jwtExpiraMin: parseInt(process.env.JWT_EXPIRA_MIN ?? '60', 10),
    pythonBin: process.env.PYTHON_BIN ?? 'python',
    ocrScriptPath: process.env.OCR_SCRIPT_PATH ?? '../split_facturas/split_consecutivos.py',
    ocrDbPath: process.env.OCR_DB_PATH ?? '../split_facturas/documentos.db',
  },
});
