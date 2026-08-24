import { BadRequestException, Inject, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Libro } from '@prisma/client';
import { PDFDocument } from 'pdf-lib';
import * as path from 'path';
import { AppConfig } from '../config/configuration';
import { Storage, STORAGE_TOKEN } from '../storage/storage.interface';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { LibrosRepository } from './libros.repository';
import { ProcesarLibroJob } from './jobs/procesar-libro.job';

const MESES: Record<string, string> = {
  ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
  JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10',
  NOVIEMBRE: '11', DICIEMBRE: '12',
};

function parsePeriodoLibro(nombreArchivo: string): Date | null {
  const nombre = nombreArchivo.toUpperCase();
  const anio = nombre.match(/(20\d{2})/)?.[1];
  const mes = Object.entries(MESES).find(([nombreMes]) => nombre.includes(nombreMes))?.[1];
  if (anio && mes) return new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
  return null;
}

@Injectable()
export class LibrosService implements OnModuleInit {
  private readonly logger = new Logger(LibrosService.name);
  private readonly storageRoot: string;

  constructor(
    private readonly repo: LibrosRepository,
    private readonly auditoria: AuditoriaService,
    private readonly job: ProcesarLibroJob,
    configService: ConfigService,
    @Inject(STORAGE_TOKEN) private readonly storage: Storage,
  ) {
    this.storageRoot = path.resolve(process.cwd(), configService.get<AppConfig>('app')!.storagePath);
  }

  // El job de OCR corre in-process, sin cola persistente (PLAN_API.md
  // seccion 8.5, decision de simplicidad para un solo usuario). Si el
  // servidor se reinicia mientras un libro esta 'procesando', ese job se
  // pierde para siempre pero el libro queda con ese estado colgado - sin
  // "Reanudar" (que solo aplica sobre 'error') ni "Eliminar" (bloqueado
  // mientras procesa) posible desde la UI. Al arrancar, ningun job pudo
  // haber sobrevivido al reinicio, asi que cualquier libro que siga en
  // 'procesando' en este punto es huerfano por definicion - se marca como
  // error para desbloquear ambas acciones.
  async onModuleInit(): Promise<void> {
    const huerfanos = await this.repo.listarPorEstado('procesando');
    for (const libro of huerfanos) {
      await this.repo.actualizar(libro.id, {
        estado: 'error',
        errorDetalle:
          'El servidor se reinicio mientras este libro estaba procesando y el job se perdio. Usa "Reanudar" para continuar desde la ultima pagina completada, o "Eliminar libro" para descartarlo.',
        finalizadoEn: new Date(),
      });
      this.logger.warn(`Libro ${libro.id} quedo huerfano en 'procesando' tras un reinicio - marcado como error`);
    }
  }

  listar(): Promise<Libro[]> {
    return this.repo.listar();
  }

  async detalle(id: number): Promise<Libro> {
    const libro = await this.repo.porId(id);
    if (!libro) throw new NotFoundException(`No existe el libro con id ${id}`);
    return libro;
  }

  documentosDe(id: number) {
    return this.repo.documentosDe(id);
  }

  // POST /libros: guarda el PDF grande de origen y encola el job de OCR sin
  // bloquear la respuesta HTTP (PLAN_API.md seccion 8). El PDF se guarda
  // aparte de la carpeta output/AAAA/MM (que es donde van los documentos ya
  // separados) para no mezclarlos.
  async subirLibro(nombreArchivo: string, archivo: Buffer, usuarioId: number): Promise<Libro> {
    const totalPaginas = await this.contarPaginas(archivo);
    const rutaRelativa = `_libros_origen/${Date.now()}_${nombreArchivo}`;
    await this.storage.guardar(rutaRelativa, archivo);

    const libro = await this.repo.crear({
      nombreArchivo,
      rutaOrigen: rutaRelativa,
      periodoLibro: parsePeriodoLibro(nombreArchivo),
      totalPaginas,
      estado: 'pendiente',
    });

    await this.auditoria.registrar({ usuarioId, accion: 'subir_libro', detalle: { libroId: libro.id, nombreArchivo } });

    const rutaAbsoluta = path.resolve(this.storageRoot, rutaRelativa);
    void this.job.ejecutar(libro.id, rutaAbsoluta, 0);

    return libro;
  }

  async estado(id: number): Promise<Libro> {
    return this.detalle(id);
  }

  // Retoma un libro que quedo en estado='error' desde la ultima pagina que
  // alcanzo a procesar (PLAN_API.md seccion 8.5).
  async reanudar(id: number, usuarioId: number): Promise<Libro> {
    const libro = await this.detalle(id);
    if (libro.estado !== 'error') {
      throw new BadRequestException(`Solo se puede reanudar un libro en estado 'error' (actual: '${libro.estado}')`);
    }

    const documentos = await this.repo.documentosDe(id);
    const ultimaPagina = documentos.reduce((max, d) => Math.max(max, d.paginaFin), -1);
    const startPage = ultimaPagina + 1;

    await this.auditoria.registrar({ usuarioId, accion: 'reanudar_libro', detalle: { libroId: id, startPage } });

    const rutaAbsoluta = path.resolve(this.storageRoot, libro.rutaOrigen);
    void this.job.ejecutar(id, rutaAbsoluta, startPage);

    return this.detalle(id);
  }

  // Borrado real y completo del libro: a diferencia de DELETE /documentos/:id
  // (soft delete, nunca borra el PDF), aqui el usuario pidio explicitamente
  // poder deshacer una carga de prueba/duplicada entera - se borran los PDFs
  // individuales generados, el PDF de origen, y todas las filas de
  // documentos y el libro en la base. No se puede deshacer.
  async eliminar(id: number, usuarioId: number): Promise<{ ok: true; documentosEliminados: number }> {
    const libro = await this.detalle(id);
    if (libro.estado === 'procesando') {
      throw new BadRequestException(
        'No se puede eliminar un libro mientras esta procesando. Espera a que termine o falle primero.',
      );
    }

    const documentos = await this.repo.todosLosDocumentosDe(id);

    for (const documento of documentos) {
      try {
        await this.storage.eliminar(documento.archivoPath);
      } catch {
        // el archivo ya podia no existir (ej. reanudar sobre datos parciales) - no bloquea el borrado del registro
      }
    }
    try {
      await this.storage.eliminar(libro.rutaOrigen);
    } catch {
      // idem
    }

    await this.repo.eliminarConDocumentos(id);

    await this.auditoria.registrar({
      usuarioId,
      accion: 'eliminar_libro',
      detalle: { libroId: id, nombreArchivo: libro.nombreArchivo, documentosEliminados: documentos.length },
    });

    return { ok: true, documentosEliminados: documentos.length };
  }

  private async contarPaginas(archivo: Buffer): Promise<number | null> {
    try {
      const pdf = await PDFDocument.load(archivo, { updateMetadata: false });
      return pdf.getPageCount();
    } catch {
      return null;
    }
  }
}
