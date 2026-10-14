// Fuerza rutas absolutas para la base de datos, el storage y el
// pipeline de OCR, calculadas desde la ubicacion real de ESTA carpeta
// en este momento -- por eso funciona sin importar a donde se copie o
// descomprima la carpeta "release" (a diferencia de rutas relativas
// tipo "file:./dev.db", cuya resolucion interna de Prisma no conviene
// dejar librada al azar).
const path = require('path');
const raiz = __dirname;
process.env.DATABASE_URL = 'file:' + path.join(raiz, 'prisma', 'dev.db').split(path.sep).join('/');
process.env.STORAGE_PATH = path.join(raiz, 'storage');
process.env.OCR_SCRIPT_PATH = path.join(raiz, 'split_facturas', 'split_consecutivos.py');
process.env.OCR_DB_PATH = path.join(raiz, 'split_facturas', 'documentos.db');
require('./dist/main.js');
