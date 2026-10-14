import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'child_process';
import { createHash } from 'crypto';
import { promises as fs, existsSync } from 'fs';
import * as path from 'path';
import { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { PersonasService } from '../../personas/personas.service';
import { LibrosRepository } from '../libros.repository';
import { OcrSqliteClient, FilaDocumentoOcr } from './ocr-sqlite.client';

// Corre split_consecutivos.py como proceso aparte (igual que ya se hace con
// Tesseract/Poppler, ver el hilo de decision Node vs Python) y despues
// importa las filas que ese proceso escribio en su propia sqlite hacia el
// schema de Prisma. No se reescribe el OCR en Node: es el "productor" que
// menciona PLAN_API.md seccion 2, aqui el "consumidor" es este import.
@Injectable()
export class ProcesarLibroJob {
  private readonly logger = new Logger(ProcesarLibroJob.name);
  private readonly config: AppConfig;
  private readonly ocrDb: OcrSqliteClient;
  private readonly storageRoot: string;
  private readonly ocrDbPathAbs: string;
  private readonly ocrScriptPathAbs: string;

  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly personas: PersonasService,
    private readonly librosRepo: LibrosRepository,
  ) {
    this.config = configService.get<AppConfig>('app')!;
    this.ocrDbPathAbs = path.resolve(process.cwd(), this.config.ocrDbPath);
    this.ocrScriptPathAbs = path.resolve(process.cwd(), this.config.ocrScriptPath);
    this.storageRoot = path.resolve(process.cwd(), this.config.storagePath);
    this.ocrDb = new OcrSqliteClient(this.ocrDbPathAbs);
  }

  // Intervalo del import incremental mientras Python sigue corriendo, para
  // que el progreso se vea en vivo (documentos_generados sube de a poco) en
  // vez de saltar de 0 al total cuando el proceso entero termina.
  private static readonly INTERVALO_IMPORT_MS = 3000;

  // Fire-and-forget desde LibrosService: no bloquea la respuesta HTTP de
  // POST /libros (PLAN_API.md seccion 8). Si falla, los documentos ya
  // importados antes del fallo quedan validos - solo se marca el libro en
  // estado='error'.
  async ejecutar(libroId: number, pdfAbsolutoOrigen: string, startPage: number): Promise<void> {
    await this.librosRepo.actualizar(libroId, { estado: 'procesando', iniciadoEn: new Date() });

    const maxIdAntes = this.existeDbOcr() ? this.ocrDb.maxIdParaPdf(pdfAbsolutoOrigen) : 0;

    // Los imports se encadenan sobre esta misma promesa (nunca corren dos a
    // la vez) para no duplicar filas en Prisma si un ciclo tarda mas que el
    // intervalo. Un fallo puntual (ej. sqlite ocupado justo en ese momento)
    // no rompe la cadena, solo se reintenta en el siguiente ciclo.
    let cadenaImport: Promise<number> = Promise.resolve(maxIdAntes);
    const encolarImport = (): void => {
      cadenaImport = cadenaImport.then(async (idAnterior) => {
        try {
          return await this.importarNuevos(libroId, pdfAbsolutoOrigen, idAnterior);
        } catch (err) {
          this.logger.warn(`Fallo un import incremental (se reintenta en el proximo ciclo): ${String(err)}`);
          return idAnterior;
        }
      });
    };

    const intervalo = setInterval(encolarImport, ProcesarLibroJob.INTERVALO_IMPORT_MS);

    try {
      await this.correrScriptPython(pdfAbsolutoOrigen, startPage);
      clearInterval(intervalo);
      encolarImport();
      await cadenaImport;
      await this.librosRepo.actualizar(libroId, { estado: 'completado', finalizadoEn: new Date() });
    } catch (err) {
      clearInterval(intervalo);
      // Aun en error, se intenta importar lo que si alcanzo a escribirse
      // (el script Python guarda cada documento de inmediato, no todo al
      // final - ver split_consecutivos.py).
      encolarImport();
      await cadenaImport.catch(() => {});
      const mensaje = err instanceof Error ? err.message : String(err);
      await this.librosRepo.actualizar(libroId, { estado: 'error', errorDetalle: mensaje, finalizadoEn: new Date() });
      this.logger.error(`Libro ${libroId} termino en error: ${mensaje}`);
    }
  }

  private existeDbOcr(): boolean {
    return existsSync(this.ocrDbPathAbs);
  }

  // --out es obligatorio: sin el, el script escribe por defecto en
  // <carpeta-del-script>/output, que solo coincide con STORAGE_PATH por
  // casualidad en dev (ambos apuntan a split_facturas/output). En el
  // paquete "release" el storage vive en otra carpeta (release/storage,
  // forzado por iniciar.js), asi que sin este flag los PDFs quedan escritos
  // fuera de donde la API los busca y el guard anti path-traversal de
  // FilesystemStorage termina rechazando la ruta importada.
  private correrScriptPython(pdfAbsoluto: string, startPage: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = [
        this.ocrScriptPathAbs,
        pdfAbsoluto,
        '--start-page',
        String(startPage),
        '--out',
        this.storageRoot,
      ];
      const proceso = spawn(this.config.pythonBin, args, { cwd: path.dirname(this.ocrScriptPathAbs) });

      let stderr = '';
      proceso.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      // split_consecutivos.py imprime una linea por pagina y otra por
      // documento guardado (cientos de lineas en un libro grande). Si nadie
      // lee stdout, el buffer del pipe del SO se llena y el proceso se
      // queda bloqueado a mitad de camino esperando que alguien lo drene -
      // nunca cierra, nunca dispara 'close', y el libro queda 'procesando'
      // para siempre. No hace falta el contenido, solo drenarlo.
      proceso.stdout.on('data', () => {});
      proceso.on('error', (err) => reject(err));
      proceso.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`split_consecutivos.py salio con codigo ${code}: ${stderr.slice(-2000)}`));
      });
    });
  }

  // Traduce cada fila nueva de la sqlite de Python al schema de Prisma:
  // resuelve/crea la persona por cedula (getOrCreatePersona, igual que en
  // la carga manual), convierte fechas "AAAA/MM/DD" a Date, calcula
  // hash/tamano del PDF ya escrito en disco, y guarda archivoPath como ruta
  // relativa al storage (python y la API comparten la misma carpeta
  // output, ver .env STORAGE_PATH).
  // Devuelve el id mas alto importado en esta pasada (o el mismo maxIdAntes
  // si no habia filas nuevas), para que el siguiente ciclo del intervalo
  // sepa desde donde seguir sin reimportar lo mismo.
  private async importarNuevos(libroId: number, pdfOrigenAbsoluto: string, maxIdAntes: number): Promise<number> {
    const filas = this.ocrDb.documentosNuevos(pdfOrigenAbsoluto, maxIdAntes);
    if (filas.length === 0) return maxIdAntes;

    let consecutivoMin: number | null = null;
    let consecutivoMax: number | null = null;
    let ultimoId = maxIdAntes;

    for (const fila of filas) {
      await this.importarFila(libroId, fila);
      ultimoId = Math.max(ultimoId, fila.id);
      const num = Number.parseInt(fila.consecutivo, 10);
      if (!Number.isNaN(num)) {
        consecutivoMin = consecutivoMin === null ? num : Math.min(consecutivoMin, num);
        consecutivoMax = consecutivoMax === null ? num : Math.max(consecutivoMax, num);
      }
    }

    // Se combina con lo que ya tenia el libro (no se sobreescribe): el
    // import ahora corre varias veces por libro, no solo una vez al final.
    const libroActual = await this.librosRepo.porId(libroId);
    const minCombinado =
      consecutivoMin === null
        ? (libroActual?.consecutivoMin ?? null)
        : libroActual?.consecutivoMin != null
          ? Math.min(libroActual.consecutivoMin, consecutivoMin)
          : consecutivoMin;
    const maxCombinado =
      consecutivoMax === null
        ? (libroActual?.consecutivoMax ?? null)
        : libroActual?.consecutivoMax != null
          ? Math.max(libroActual.consecutivoMax, consecutivoMax)
          : consecutivoMax;

    await this.librosRepo.actualizar(libroId, {
      documentosGenerados: (libroActual?.documentosGenerados ?? 0) + filas.length,
      ...(minCombinado !== null ? { consecutivoMin: minCombinado } : {}),
      ...(maxCombinado !== null ? { consecutivoMax: maxCombinado } : {}),
    });

    return ultimoId;
  }

  private async importarFila(libroId: number, fila: FilaDocumentoOcr): Promise<void> {
    const personaOcr = this.ocrDb.persona(fila.persona_id);
    const persona = await this.personas.getOrCreatePersona(personaOcr?.cedula ?? null, personaOcr?.nombre ?? null);

    const rutaRelativa = path.relative(this.storageRoot, fila.archivo).split(path.sep).join('/');
    const rutaAbsoluta = path.resolve(this.storageRoot, rutaRelativa);
    const bytes = await fs.readFile(rutaAbsoluta);
    const hash = createHash('sha256').update(bytes).digest('hex');

    // El OCR a veces lee una fecha con formato correcto pero valor
    // imposible (ej. "2024/01/90", dia inexistente): eso da un Date
    // invalido que Prisma rechaza y, sin este chequeo, tira esa fila para
    // siempre en cada reintento del import incremental - bloqueando todos
    // los documentos que vienen despues. Se trata igual que "sin fecha":
    // se guarda null y se manda a revisar en vez de frenar el pipeline.
    const fecha = fila.fecha ? this.parsearFechaSegura(fila.fecha.replace(/\//g, '-')) : null;
    const periodoLibro = fila.periodo_libro
      ? this.parsearFechaSegura(`${fila.periodo_libro.replace('/', '-')}-01`)
      : null;
    const consecutivoNum = Number.parseInt(fila.consecutivo, 10);

    // El bit "revisar" de Python no distingue el motivo; se infiere aqui
    // (ver comentario en el job) para poblar motivo_revisar y poder
    // filtrar la cola de revision por causa (PLAN_API.md seccion 10).
    const motivo = await this.inferirMotivoRevisar(fila, personaOcr, consecutivoNum, fecha);

    await this.prisma.documento.create({
      data: {
        libroId,
        origen: 'ocr',
        personaId: persona?.id ?? null,
        consecutivo: fila.consecutivo,
        consecutivoNum: Number.isNaN(consecutivoNum) ? null : consecutivoNum,
        fecha,
        periodoLibro,
        revisar: !!fila.revisar || motivo !== null,
        motivoRevisar: motivo,
        paginaInicio: fila.pagina_inicio,
        paginaFin: fila.pagina_fin,
        archivoPath: rutaRelativa,
        tamanoBytes: bytes.length,
        hashSha256: hash,
        procesadoEn: new Date(fila.procesado_en),
      },
    });
  }

  // Devuelve null si el string no es una fecha real (ej. "2024-01-90"),
  // en vez de dejar pasar un Date invalido que Prisma va a rechazar.
  private parsearFechaSegura(valor: string): Date | null {
    const fecha = new Date(valor);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  }

  private async inferirMotivoRevisar(
    fila: FilaDocumentoOcr,
    personaOcr: { cedula: string | null } | null,
    consecutivoNum: number,
    fecha: Date | null,
  ): Promise<string | null> {
    if (!fila.revisar) {
      if (!personaOcr?.cedula) return 'sin_cedula';
      if (!fecha) return 'sin_fecha';
      return null;
    }
    if (Number.isNaN(consecutivoNum)) return 'consecutivo_fuera_de_tendencia';
    const duplicado = await this.prisma.documento.findFirst({
      where: { consecutivoNum, eliminadoEn: null },
    });
    return duplicado ? 'consecutivo_repetido' : 'consecutivo_fuera_de_tendencia';
  }
}
