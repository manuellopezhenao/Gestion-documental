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

paso('Generando cliente de Prisma (para el motor del schema actual)...');
ejecutar('npx', ['prisma', 'generate'], apiDir);

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

paso('Copiando schema, migraciones y seed de Prisma...');
// La base vive en el SQL Server que se configure en release/.env, no en
// este paquete: no se empaqueta ningun dato. iniciar.js aplica las
// migraciones pendientes y corre el seed (admin) cada vez que arranca,
// asi una base vacia queda lista sola y una ya creada no se toca.
mkdirSync(path.join(releaseDir, 'prisma'), { recursive: true });
cpSync(path.join(apiDir, 'prisma', 'schema.prisma'), path.join(releaseDir, 'prisma', 'schema.prisma'));
cpSync(path.join(apiDir, 'prisma', 'migrations'), path.join(releaseDir, 'prisma', 'migrations'), { recursive: true });
cpSync(path.join(apiDir, 'prisma', 'seed.js'), path.join(releaseDir, 'prisma', 'seed.js'));

paso('Creando carpeta de storage vacia (los PDFs de prueba no se empaquetan)...');
mkdirSync(path.join(releaseDir, 'storage'), { recursive: true });

paso('Copiando el pipeline de OCR (script de Python + tessdata + su db)...');
// "Subir libro" no lo procesa Node -- la API llama por afuera a este script
// de Python (ver PLAN_API.md seccion 3 y procesar-libro.job.ts), que a su
// vez usa Tesseract OCR. Node/npm no puede empaquetar Python ni Tesseract
// (eso lo instala aparte quien vaya a usar "Subir libro", ver README.md),
// pero el script en si y su tessdata SI hay que copiarlos: no son parte de
// api/ ni frontend/, viven en split_facturas/ a la par, y sin esto "Subir
// libro" fallaba porque el archivo ni siquiera llegaba a la carpeta que se
// le manda al usuario.
// La documentos.db de Python a proposito NO se copia (a diferencia del
// script en si y tessdata, que si son necesarios): split_consecutivos.py
// la crea sola con "CREATE TABLE IF NOT EXISTS" en el primer "Subir
// libro" si no existe, y copiar la tuya llevaria filas de prueba.
const ocrOrigenDir = path.resolve(apiDir, '..', 'split_facturas');
const ocrDestinoDir = path.join(releaseDir, 'split_facturas');
mkdirSync(ocrDestinoDir, { recursive: true });
cpSync(path.join(ocrOrigenDir, 'split_consecutivos.py'), path.join(ocrDestinoDir, 'split_consecutivos.py'));
if (existsSync(path.join(ocrOrigenDir, 'tessdata'))) {
	cpSync(path.join(ocrOrigenDir, 'tessdata'), path.join(ocrDestinoDir, 'tessdata'), { recursive: true });
}

paso('Generando .env de release...');
const apiEnv = path.join(apiDir, '.env');
const jwtSecret = leerValorEnv(apiEnv, 'JWT_SECRET') ?? 'cambia-este-valor-en-produccion';
const adminEmail = leerValorEnv(apiEnv, 'ADMIN_EMAIL') ?? 'femcentral@gmail.com';
const adminPassword = leerValorEnv(apiEnv, 'ADMIN_PASSWORD') ?? 'Femcentral2026*';
writeFileSync(
	path.join(releaseDir, '.env'),
	[
		'# Conexion al SQL Server del cliente -- UNICA linea que hay que editar.',
		'# La base tiene que existir (vacia sirve); las tablas y el usuario admin',
		'# se crean solos al arrancar. Variantes de formato en README.md.',
		'DATABASE_URL="sqlserver://localhost:1433;database=gestion_documental;user=sa;password=CAMBIAR;trustServerCertificate=true"',
		'',
		`ADMIN_EMAIL=${adminEmail}`,
		`ADMIN_PASSWORD=${adminPassword}`,
		'',
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
	`// 1) Fuerza rutas absolutas para el storage y el pipeline de OCR,\n` +
		`//    calculadas desde la ubicacion real de ESTA carpeta -- funciona sin\n` +
		`//    importar a donde se copie o descomprima "release".\n` +
		`// 2) Aplica migraciones pendientes y crea/actualiza el admin en el SQL\n` +
		`//    Server de DATABASE_URL (.env). Idempotente: en una base ya al dia\n` +
		`//    no cambia nada. Si falla (conexion mal, server apagado) se corta\n` +
		`//    aca con el error en inicio.log, en vez de levantar una API rota.\n` +
		`const path = require('path');\n` +
		`const { execFileSync } = require('child_process');\n` +
		`const raiz = __dirname;\n` +
		`require('dotenv').config({ path: path.join(raiz, '.env') });\n` +
		`process.env.STORAGE_PATH = path.join(raiz, 'storage');\n` +
		`process.env.OCR_SCRIPT_PATH = path.join(raiz, 'split_facturas', 'split_consecutivos.py');\n` +
		`process.env.OCR_DB_PATH = path.join(raiz, 'split_facturas', 'documentos.db');\n` +
		`\n` +
		`// DB_REINTENTOS lo pone iniciar.bat (arranque con el PC): el servicio de\n` +
		`// SQL Server puede tardar en levantar despues del boot. "npm start" a\n` +
		`// mano no lo setea, asi una conexion mal configurada falla al instante.\n` +
		`const opciones = { cwd: raiz, stdio: 'inherit', env: process.env };\n` +
		`const intentos = Math.max(1, Number(process.env.DB_REINTENTOS) || 1);\n` +
		`for (let i = 1; ; i++) {\n` +
		`  try {\n` +
		`    execFileSync(process.execPath, [path.join(raiz, 'node_modules', 'prisma', 'build', 'index.js'), 'migrate', 'deploy', '--schema', path.join(raiz, 'prisma', 'schema.prisma')], opciones);\n` +
		`    execFileSync(process.execPath, [path.join(raiz, 'prisma', 'seed.js')], opciones);\n` +
		`    break;\n` +
		`  } catch (err) {\n` +
		`    if (i >= intentos) {\n` +
		`      console.error('No se pudo preparar la base de datos. Revisar DATABASE_URL en .env y que el SQL Server este encendido y la base exista.');\n` +
		`      process.exit(1);\n` +
		`    }\n` +
		`    console.error(\`Base de datos no disponible (intento \${i}/\${intentos}), reintentando en 15s...\`);\n` +
		`    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 15000);\n` +
		`  }\n` +
		`}\n` +
		`\n` +
		`require('./dist/main.js');\n`
);

paso('Copiando iniciar.bat / instalar-arranque.bat / desinstalar-arranque.bat...');
// Estos tres son estaticos (no dependen de nada calculado en este build),
// asi que viven como archivos de verdad en scripts/windows/ -- versionados
// en git, editables como cualquier otro archivo -- en vez de generarse
// inline aqui. "instalar-arranque.bat" pide permiso de administrador y
// registra una tarea programada que corre iniciar.bat al encender el PC
// (no solo al iniciar sesion), con la cuenta SYSTEM; "%~dp0" ahi adentro
// asegura que apunte a ESTA carpeta sin importar donde se descomprima el
// release.
const winScriptsDir = path.join(raizRepo, 'scripts', 'windows');
for (const nombre of ['iniciar.bat', 'instalar-arranque.bat', 'desinstalar-arranque.bat']) {
	cpSync(path.join(winScriptsDir, nombre), path.join(releaseDir, nombre));
}

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
console.log('  Para que arranque solo con el PC: correr "instalar-arranque.bat" (doble click) alla -- ver README.md seccion 7.');
