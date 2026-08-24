// Migra los datos que ya existen en split_facturas/documentos.db (escritos
// por split_consecutivos.py) hacia el schema nuevo de Prisma. Es el script
// de "leer todo de SQLite e insertar con los modelos nuevos" que pide el
// checklist de corte de PLAN_API.md seccion 5.7 - NO se ejecuta
// automaticamente, es de un solo uso y se corre a mano cuando se decida.
//
// Solo LEE split_facturas/documentos.db (nunca escribe ahi) y escribe en la
// base configurada por DATABASE_URL (por defecto api/prisma/dev.db). Es
// seguro correrlo varias veces: si un documento ya fue importado (mismo
// archivo_path) se omite.
//
// Uso:
//   npx ts-node scripts/migrar-desde-python.ts [ruta-a-documentos.db]
//
import { PrismaClient } from '@prisma/client';
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';

interface FilaPersona {
  id: number;
  cedula: string | null;
  nombre: string | null;
}

interface FilaDocumento {
  id: number;
  consecutivo: string;
  persona_id: number | null;
  fecha: string | null;
  periodo_libro: string | null;
  revisar: number;
  pagina_inicio: number;
  pagina_fin: number;
  archivo: string;
  pdf_origen: string;
  procesado_en: string;
}

const STORAGE_ROOT = path.resolve(process.cwd(), process.env.STORAGE_PATH ?? '../split_facturas/output');

function parseFecha(fecha: string | null): Date | null {
  return fecha ? new Date(fecha.replace(/\//g, '-')) : null;
}

function parsePeriodoLibro(periodo: string | null): Date | null {
  if (!periodo) return null;
  const [anio, mes] = periodo.split('/');
  return new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
}

async function main() {
  const ocrDbPath = path.resolve(process.argv[2] ?? '../split_facturas/documentos.db');
  if (!existsSync(ocrDbPath)) {
    console.error(`No existe la base de Python en: ${ocrDbPath}`);
    process.exit(1);
  }

  const ocrDb = new DatabaseSync(ocrDbPath, { readOnly: true });
  const prisma = new PrismaClient();

  const personas = ocrDb.prepare('SELECT * FROM personas').all() as unknown as FilaPersona[];
  const documentos = ocrDb.prepare('SELECT * FROM documentos ORDER BY id ASC').all() as unknown as FilaDocumento[];
  console.log(`Leidos ${personas.length} personas y ${documentos.length} documentos de ${ocrDbPath}`);

  const personaPorViejoId = new Map(personas.map((p) => [p.id, p]));

  // Agrupa por pdf_origen para crear una fila "libros" por cada PDF grande
  // ya procesado (PLAN_API.md Fase 0, item "Tabla libros y migracion de los
  // datos existentes de pdf_origen a la nueva relacion").
  const libroIdPorPdfOrigen = new Map<string, number>();
  const pdfOrigenes = [...new Set(documentos.map((d) => d.pdf_origen))];

  for (const pdfOrigen of pdfOrigenes) {
    const existente = await prisma.libro.findFirst({ where: { rutaOrigen: pdfOrigen } });
    if (existente) {
      libroIdPorPdfOrigen.set(pdfOrigen, existente.id);
      console.log(`Libro ya existia: ${existente.nombreArchivo} -> id ${existente.id}`);
      continue;
    }

    const docsDelLibro = documentos.filter((d) => d.pdf_origen === pdfOrigen);
    const nums = docsDelLibro.map((d) => Number.parseInt(d.consecutivo, 10)).filter((n) => !Number.isNaN(n));
    const nombreArchivo = path.basename(pdfOrigen);

    const libro = await prisma.libro.create({
      data: {
        nombreArchivo,
        rutaOrigen: pdfOrigen,
        documentosGenerados: docsDelLibro.length,
        consecutivoMin: nums.length ? Math.min(...nums) : null,
        consecutivoMax: nums.length ? Math.max(...nums) : null,
        estado: 'completado',
        finalizadoEn: new Date(Math.max(...docsDelLibro.map((d) => new Date(d.procesado_en).getTime()))),
      },
    });
    libroIdPorPdfOrigen.set(pdfOrigen, libro.id);
    console.log(`Libro creado: ${nombreArchivo} -> id ${libro.id} (${docsDelLibro.length} documentos)`);
  }

  const cedulaAPersonaId = new Map<string, number>();
  let importados = 0;
  let omitidos = 0;
  let sinArchivo = 0;

  for (const fila of documentos) {
    const rutaRelativa = path.relative(STORAGE_ROOT, fila.archivo).split(path.sep).join('/');

    const yaExiste = await prisma.documento.findFirst({ where: { archivoPath: rutaRelativa } });
    if (yaExiste) {
      omitidos += 1;
      continue;
    }

    const personaOcr = fila.persona_id ? personaPorViejoId.get(fila.persona_id) ?? null : null;
    let personaId: number | null = null;
    if (personaOcr?.cedula) {
      const cacheId = cedulaAPersonaId.get(personaOcr.cedula);
      if (cacheId) {
        personaId = cacheId;
      } else {
        const persona = await prisma.persona.upsert({
          where: { cedula: personaOcr.cedula },
          update: personaOcr.nombre ? { nombre: personaOcr.nombre } : {},
          create: { cedula: personaOcr.cedula, nombre: personaOcr.nombre },
        });
        cedulaAPersonaId.set(personaOcr.cedula, persona.id);
        personaId = persona.id;
      }
    }

    let tamanoBytes: number | null = null;
    let hashSha256: string | null = null;
    if (existsSync(fila.archivo)) {
      const bytes = readFileSync(fila.archivo);
      tamanoBytes = bytes.length;
      hashSha256 = createHash('sha256').update(bytes).digest('hex');
    } else {
      sinArchivo += 1;
      console.warn(`Aviso: no se encontro el PDF en disco para el documento ${fila.id}: ${fila.archivo}`);
    }

    const consecutivoNum = Number.parseInt(fila.consecutivo, 10);
    const motivoRevisar = !fila.revisar
      ? !personaOcr?.cedula
        ? 'sin_cedula'
        : !fila.fecha
          ? 'sin_fecha'
          : null
      : 'consecutivo_fuera_de_tendencia';

    await prisma.documento.create({
      data: {
        libroId: libroIdPorPdfOrigen.get(fila.pdf_origen) ?? null,
        origen: 'ocr',
        personaId,
        consecutivo: fila.consecutivo,
        consecutivoNum: Number.isNaN(consecutivoNum) ? null : consecutivoNum,
        fecha: parseFecha(fila.fecha),
        periodoLibro: parsePeriodoLibro(fila.periodo_libro),
        revisar: !!fila.revisar || motivoRevisar !== null,
        motivoRevisar,
        paginaInicio: fila.pagina_inicio,
        paginaFin: fila.pagina_fin,
        archivoPath: rutaRelativa,
        tamanoBytes,
        hashSha256,
        procesadoEn: new Date(fila.procesado_en),
      },
    });
    importados += 1;
  }

  console.log(`\nListo: ${importados} documento(s) importados, ${omitidos} ya existian, ${sinArchivo} sin PDF en disco.`);

  ocrDb.close();
  await prisma.$disconnect();
}

main();
