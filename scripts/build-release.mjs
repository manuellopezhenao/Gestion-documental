// Empaqueta la app entera (API + frontend) en una sola carpeta autocontenida
// que se puede copiar a otra PC y arrancar con un solo comando ("npm start"
// dentro de esa carpeta) -- sin instalar nada mas, sin correr dos servidores
// aparte. Ver la conversacion sobre "mandarle esto a un usuario para
// pruebas" -- este script es la parte que corre en TU maquina; la carpeta
// "release/" resultante es lo que se le manda al usuario.
import { existsSync, mkdirSync, rmSync, cpSync, writeFileSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raizRepo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = path.join(raizRepo, 'api');
const frontendDir = path.join(raizRepo, 'frontend');
const releaseDir = path.join(raizRepo, 'release');

function paso(mensaje) {
	console.log(`\n▶ ${mensaje}`);
}

function ejecutar(cmd, args, cwd, envExtra = {}) {
	execFileSync(cmd, args, {
		cwd,
		stdio: 'inherit',
		shell: process.platform === 'win32',
		env: { ...process.env, ...envExtra }
	});
}

function leerValorEnv(rutaEnv, clave) {
	if (!existsSync(rutaEnv)) return null;
	const linea = readFileSync(rutaEnv, 'utf8')
		.split('\n')
		.find((l) => l.startsWith(`${clave}=`));
	if (!linea) return null;
	return linea.slice(clave.length + 1).trim().replace(/^"|"$/g, '');
}

paso('Compilando frontend (build estatico, va a llamar a la API por su propio origen)...');
// PUBLIC_API_URL vacio => el frontend construido llama a la API con ruta
// relativa (window.location.origin), porque en el paquete final la sirve
// la MISMA API en el mismo puerto (ver src/main.ts) -- no hace falta el
// http://localhost:3000 que se usa en desarrollo con dos puertos.
ejecutar('npm', ['run', 'build'], frontendDir, { PUBLIC_API_URL: '' });

paso('Compilando API (NestJS)...');
ejecutar('npm', ['run', 'build'], apiDir);

paso('Preparando carpeta de release limpia...');
// maxRetries/retryDelay: en carpetas sincronizadas por OneDrive (como esta),
// el propio OneDrive puede retener un lock momentaneo sobre archivos recien
// tocados y hacer fallar el primer intento de borrado con EPERM/EBUSY -- no
// es un error real, con un par de reintentos ya se libera.
if (existsSync(releaseDir)) rmSync(releaseDir, { recursive: true, force: true, maxRetries: 10, retryDelay: 500 });
mkdirSync(releaseDir, { recursive: true });

paso('Copiando API compilada...');
cpSync(path.join(apiDir, 'dist'), path.join(releaseDir, 'dist'), { recursive: true });

paso('Copiando dependencias (node_modules) -- puede tardar un rato...');
cpSync(path.join(apiDir, 'node_modules'), path.join(releaseDir, 'node_modules'), { recursive: true });

paso('Copiando el build del frontend...');
cpSync(path.join(frontendDir, 'build'), path.join(releaseDir, 'public'), { recursive: true });

paso('Copiando base de datos y esquema de Prisma...');
mkdirSync(path.join(releaseDir, 'prisma'), { recursive: true });
cpSync(path.join(apiDir, 'prisma', 'schema.prisma'), path.join(releaseDir, 'prisma', 'schema.prisma'));
const dbOrigen = path.join(apiDir, 'prisma', 'dev.db');
if (existsSync(dbOrigen)) {
	cpSync(dbOrigen, path.join(releaseDir, 'prisma', 'dev.db'));
} else {
	console.warn('  (no se encontro prisma/dev.db en api/ -- el release arranca sin datos)');
}

paso('Copiando archivos PDF (storage)...');
const storageOrigen = path.resolve(apiDir, '..', 'split_facturas', 'output');
if (existsSync(storageOrigen)) {
	cpSync(storageOrigen, path.join(releaseDir, 'storage'), { recursive: true });
} else {
	mkdirSync(path.join(releaseDir, 'storage'), { recursive: true });
}

paso('Copiando el pipeline de OCR (script de Python + tessdata + su db)...');
// "Subir libro" no lo procesa Node -- la API llama por afuera a este script
// de Python (ver PLAN_API.md seccion 3 y procesar-libro.job.ts), que a su
// vez usa Tesseract OCR. Node/npm no puede empaquetar Python ni Tesseract
// (eso lo instala aparte quien vaya a usar "Subir libro", ver README.md),
// pero el script en si y su tessdata SI hay que copiarlos: no son parte de
// api/ ni frontend/, viven en split_facturas/ a la par, y sin esto "Subir
// libro" fallaba porque el archivo ni siquiera llegaba a la carpeta que se
// le manda al usuario.
const ocrOrigenDir = path.resolve(apiDir, '..', 'split_facturas');
const ocrDestinoDir = path.join(releaseDir, 'split_facturas');
mkdirSync(ocrDestinoDir, { recursive: true });
cpSync(path.join(ocrOrigenDir, 'split_consecutivos.py'), path.join(ocrDestinoDir, 'split_consecutivos.py'));
if (existsSync(path.join(ocrOrigenDir, 'tessdata'))) {
	cpSync(path.join(ocrOrigenDir, 'tessdata'), path.join(ocrDestinoDir, 'tessdata'), { recursive: true });
}
const ocrDbOrigen = path.join(ocrOrigenDir, 'documentos.db');
if (existsSync(ocrDbOrigen)) {
	cpSync(ocrDbOrigen, path.join(ocrDestinoDir, 'documentos.db'));
}

paso('Generando .env de release...');
const jwtSecret = leerValorEnv(path.join(apiDir, '.env'), 'JWT_SECRET') ?? 'cambia-este-valor-en-produccion';
writeFileSync(
	path.join(releaseDir, '.env'),
	[
		'DATABASE_URL="file:./dev.db"',
		'STORAGE_BACKEND=filesystem',
		'STORAGE_PATH=./storage',
		`JWT_SECRET=${jwtSecret}`,
		'JWT_EXPIRA_MIN=720',
		'PORT=3000',
		'LOG_LEVEL=info',
		'',
		'# "Subir libro" (OCR) -- requiere Python + Tesseract instalados aparte',
		'# en esta maquina, ver README.md en la raiz del proyecto.',
		'PYTHON_BIN=python',
		'OCR_SCRIPT_PATH=./split_facturas/split_consecutivos.py',
		'OCR_DB_PATH=./split_facturas/documentos.db'
	].join('\n') + '\n'
);

paso('Generando iniciar.js y package.json de release...');
writeFileSync(
	path.join(releaseDir, 'iniciar.js'),
	`// Fuerza rutas absolutas para la base de datos, el storage y el\n` +
		`// pipeline de OCR, calculadas desde la ubicacion real de ESTA carpeta\n` +
		`// en este momento -- por eso funciona sin importar a donde se copie o\n` +
		`// descomprima la carpeta "release" (a diferencia de rutas relativas\n` +
		`// tipo "file:./dev.db", cuya resolucion interna de Prisma no conviene\n` +
		`// dejar librada al azar).\n` +
		`const path = require('path');\n` +
		`const raiz = __dirname;\n` +
		`process.env.DATABASE_URL = 'file:' + path.join(raiz, 'prisma', 'dev.db').split(path.sep).join('/');\n` +
		`process.env.STORAGE_PATH = path.join(raiz, 'storage');\n` +
		`process.env.OCR_SCRIPT_PATH = path.join(raiz, 'split_facturas', 'split_consecutivos.py');\n` +
		`process.env.OCR_DB_PATH = path.join(raiz, 'split_facturas', 'documentos.db');\n` +
		`require('./dist/main.js');\n`
);

writeFileSync(
	path.join(releaseDir, 'package.json'),
	JSON.stringify(
		{
			name: 'gestion-documental',
			private: true,
			version: '1.0.0',
			description: 'Paquete listo para correr -- ver como arrancar en package.json > scripts.start',
			scripts: { start: 'node iniciar.js' }
		},
		null,
		2
	) + '\n'
);

console.log(`\n✔ Listo. Carpeta generada en: ${releaseDir}`);
console.log('  Para probarla ahora mismo:');
console.log('    cd release');
console.log('    npm start');
console.log('  Para mandarsela al usuario: comprimi toda la carpeta "release" en un .zip y mandaselo.');
console.log('  En su PC: descomprimir en cualquier lado, entrar a la carpeta, y correr "npm start".');
