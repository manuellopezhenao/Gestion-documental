import { spawnSync } from 'child_process';

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

// En Windows/Linux el binario suele llamarse "python"; en macOS casi siempre
// es "python3" ("python" no existe salvo que el usuario lo linkee a mano).
// Si PYTHON_BIN no viene seteado en el .env, se prueba cada candidato con
// --version y se usa el primero que responda, en vez de asumir uno fijo.
function detectarPythonBin(): string {
  const candidatos = ['python3', 'python'];
  for (const candidato of candidatos) {
    const resultado = spawnSync(candidato, ['--version']);
    if (!resultado.error) return candidato;
  }
  return 'python';
}

export default (): { app: AppConfig } => ({
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
