import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Documento } from '@prisma/client';
import { createHash } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { DocumentosRepository, DocumentoConRelaciones } from './documentos.repository';
import { PersonasService } from '../personas/personas.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { Storage, STORAGE_TOKEN } from '../storage/storage.interface';
import { BuscarDocumentosDto } from './dto/buscar-documentos.dto';
import { CrearDocumentoManualDto } from './dto/crear-documento-manual.dto';
import { ActualizarDocumentoDto } from './dto/actualizar-documento.dto';
import { DividirDocumentoDto } from './dto/dividir-documento.dto';

export interface ResultadoBusqueda {
  total: number;
  page: number;
  page_size: number;
  resultados: DocumentoConRelaciones[];
}

type UsuarioResumen = { id: number; email: string; rol: string } | null;

export interface VersionArchivo {
  indice: number;
  fecha: Date;
  usuario: UsuarioResumen;
  vigente: boolean;
}

interface VersionArchivoInterna extends VersionArchivo {
  archivoPath: string;
}

@Injectable()
export class DocumentosService {
  constructor(
    private readonly repo: DocumentosRepository,
    private readonly personas: PersonasService,
    private readonly auditoria: AuditoriaService,
    @Inject(STORAGE_TOKEN) private readonly storage: Storage,
  ) {}

  async buscar(filtros: BuscarDocumentosDto): Promise<ResultadoBusqueda> {
    const [resultados, total] = await this.repo.buscar(filtros);
    return { total, page: filtros.page ?? 1, page_size: filtros.page_size ?? 50, resultados };
  }

  async detalle(id: number): Promise<DocumentoConRelaciones> {
    const doc = await this.repo.porId(id);
    if (!doc) throw new NotFoundException(`No existe el documento con id ${id}`);
    return doc;
  }

  async obtenerArchivo(id: number, usuarioId: number): Promise<{ buffer: Buffer; documento: DocumentoConRelaciones }> {
    const documento = await this.detalle(id);
    const buffer = await this.storage.leer(documento.archivoPath);
    await this.auditoria.registrar({ usuarioId, accion: 'descargar', documentoId: id });
    return { buffer, documento };
  }

  // Reconstruye el historial de versiones del PDF a partir de los propios
  // registros de auditoria de 'editar' que traen archivo_reemplazado (ver
  // actualizar()) -- no existe una tabla de versiones separada, la cadena
  // se arma leyendo, de mas reciente a mas vieja, quien reemplazo a quien.
  // La version mas vieja de todas es la carga original (sin evento
  // 'editar' que la haya creado).
  private async calcularVersiones(id: number): Promise<VersionArchivoInterna[]> {
    const documento = await this.detalle(id);

    const historial = await this.auditoria.buscar({ documento_id: id, accion: 'editar', page_size: 500 });
    const eventos = historial.resultados
      .map((r) => {
        const detalle = r.detalle as { archivo_reemplazado?: { anterior: string; nuevo: string } } | null;
        return detalle?.archivo_reemplazado
          ? { fecha: new Date(r.fecha), usuario: r.usuario, anterior: detalle.archivo_reemplazado.anterior }
          : null;
      })
      .filter((e): e is { fecha: Date; usuario: UsuarioResumen; anterior: string } => e !== null);
    // historial.resultados ya viene ordenado desc por fecha (mas reciente
    // primero, ver AuditoriaService.buscar), asi que "eventos" tambien.

    let usuarioOriginal: UsuarioResumen = null;
    if (documento.origen === 'manual') {
      const creacion = await this.auditoria.buscar({ documento_id: id, accion: 'subir_documento_manual', page_size: 1 });
      usuarioOriginal = creacion.resultados[0]?.usuario ?? null;
    }

    const totalVersiones = eventos.length + 1;
    const versiones: VersionArchivoInterna[] = [];
    for (let indice = 0; indice < totalVersiones; indice++) {
      const creador = indice < eventos.length ? eventos[indice] : null;
      versiones.push({
        indice,
        archivoPath: indice === 0 ? documento.archivoPath : eventos[indice - 1].anterior,
        fecha: creador ? creador.fecha : documento.procesadoEn,
        usuario: creador ? creador.usuario : usuarioOriginal,
        vigente: indice === 0,
      });
    }
    return versiones;
  }

  // GET /documentos/:id/versiones: lista sin exponer rutas de archivo
  // crudas -- para descargar una version puntual se usa archivoVersion().
  async versiones(id: number): Promise<VersionArchivo[]> {
    const versiones = await this.calcularVersiones(id);
    return versiones.map(({ archivoPath: _archivoPath, ...resto }) => resto);
  }

  async archivoVersion(
    id: number,
    indice: number,
    usuarioId: number,
  ): Promise<{ buffer: Buffer; documento: DocumentoConRelaciones; version: VersionArchivo }> {
    const documento = await this.detalle(id);
    const versiones = await this.calcularVersiones(id);
    const version = versiones[indice];
    if (!version) throw new NotFoundException(`No existe la version ${indice} de este documento`);

    const buffer = await this.storage.leer(version.archivoPath);
    await this.auditoria.registrar({
      usuarioId,
      accion: 'descargar',
      documentoId: id,
      detalle: { version: indice, vigente: version.vigente },
    });
    return { buffer, documento, version };
  }

  // A diferencia de la carga por lotes (OCR, ver libros/jobs), aqui el dato
  // lo escribe la persona que sube el documento -- no tiene sentido validar
  // tendencia creciente/decreciente porque no hay lectura automatica que
  // pueda fallar. Lo unico que se verifica es que no exista ya un documento
  // activo con el mismo consecutivo, y en ese caso se bloquea la carga en
  // vez de solo marcarla para revision.
  private async chequearConsecutivo(
    consecutivo: string,
    excluirId?: number,
  ): Promise<{ consecutivoNum: number | null; revisar: boolean; motivo: string | null }> {
    const num = Number.parseInt(consecutivo, 10);
    if (Number.isNaN(num)) {
      return { consecutivoNum: null, revisar: true, motivo: 'consecutivo_no_numerico' };
    }

    const duplicado = await this.repo.existeConsecutivo(num, excluirId);
    if (duplicado) {
      throw new ConflictException(`Ya existe un documento activo con el consecutivo ${consecutivo}`);
    }

    return { consecutivoNum: num, revisar: false, motivo: null };
  }

  // Traduccion de build_output_path: organiza el PDF en AAAA/MM (fecha del
  // documento, o el periodo del libro como respaldo), o "sin_fecha" si no
  // hay ninguna de las dos. Sin periodo de libro para carga manual (7.1.1).
  private async construirRutaArchivo(
    consecutivo: string,
    cedula: string | null,
    fecha: Date | null,
  ): Promise<string> {
    const subdir = fecha
      ? `${fecha.getUTCFullYear()}/${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`
      : 'sin_fecha';
    const base = cedula ? `${consecutivo}_${cedula}` : `${consecutivo}_desconocido`;

    let candidato = `${subdir}/${base}.pdf`;
    let n = 2;
    while (await this.storage.existe(candidato)) {
      candidato = `${subdir}/${base}_${n}.pdf`;
      n += 1;
    }
    return candidato;
  }

  // POST /documentos (PLAN_API.md 7.1.1): reutiliza get_or_create_persona.
  // Lanza ConflictException si el consecutivo ya existe (ver
  // chequearConsecutivo) -- se rechaza la carga en vez de guardarla.
  async crearManual(
    dto: CrearDocumentoManualDto,
    archivo: Buffer,
    usuarioId: number,
  ): Promise<Documento> {
    const fecha = dto.fecha ? new Date(dto.fecha) : null;
    const cedula = dto.cedula ?? null;
    const nombre = dto.nombre ?? null;

    const persona = await this.personas.getOrCreatePersona(cedula, nombre);
    const { consecutivoNum, revisar, motivo } = await this.chequearConsecutivo(dto.consecutivo);
    const rutaArchivo = await this.construirRutaArchivo(dto.consecutivo, cedula, fecha);

    await this.storage.guardar(rutaArchivo, archivo);
    const hash = createHash('sha256').update(archivo).digest('hex');

    const documento = await this.repo.crear({
      libroId: null,
      origen: 'manual',
      personaId: persona?.id ?? null,
      consecutivo: dto.consecutivo,
      consecutivoNum,
      fecha,
      periodoLibro: null,
      revisar,
      motivoRevisar: motivo,
      paginaInicio: 0,
      paginaFin: 0,
      archivoPath: rutaArchivo,
      tamanoBytes: archivo.length,
      hashSha256: hash,
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'subir_documento_manual',
      documentoId: documento.id,
      detalle: { consecutivo: dto.consecutivo, cedula, revisar },
    });

    return documento;
  }

  // PATCH /documentos/:id: unica forma de corregir cedula/nombre/fecha/
  // consecutivo y, opcionalmente, reemplazar el PDF, aditiva y auditada
  // (PLAN_API.md seccion 10). Si se sube contenido nuevo (reemplazo), el
  // archivo viejo NUNCA se borra (mismo criterio que eliminar() / soft
  // delete, para poder recuperar una version anterior) -- construirRutaArchivo
  // ya evita pisarlo generando un nombre "_2" si el destino existe. Si en
  // cambio solo cambio fecha/cedula/consecutivo y el archivo se reubica de
  // carpeta, el viejo SI se borra (ver comentario mas abajo): es el mismo
  // contenido, no una version distinta.
  async actualizar(
    id: number,
    dto: ActualizarDocumentoDto,
    usuarioId: number,
    archivo?: Buffer,
  ): Promise<Documento> {
    const actual = await this.detalle(id);

    let personaId = actual.personaId;
    if (dto.cedula) {
      const persona = await this.personas.getOrCreatePersona(dto.cedula, dto.nombre ?? null);
      personaId = persona?.id ?? null;
    } else if (dto.nombre && actual.personaId) {
      await this.personas.getOrCreatePersona(actual.persona?.cedula ?? null, dto.nombre);
    }

    const antes = {
      consecutivo: actual.consecutivo,
      fecha: actual.fecha,
      personaId: actual.personaId,
      archivoPath: actual.archivoPath,
    };

    const consecutivoFinal = dto.consecutivo ?? actual.consecutivo;
    const cedulaFinal = dto.cedula ?? actual.persona?.cedula ?? null;
    const fechaFinal = dto.fecha ? new Date(dto.fecha) : actual.fecha;

    let datosArchivo: { archivoPath: string; tamanoBytes: number; hashSha256: string } | null = null;
    let archivoReubicado: { anterior: string; nuevo: string } | null = null;

    if (archivo) {
      const rutaArchivo = await this.construirRutaArchivo(consecutivoFinal, cedulaFinal, fechaFinal);
      await this.storage.guardar(rutaArchivo, archivo);
      datosArchivo = {
        archivoPath: rutaArchivo,
        tamanoBytes: archivo.length,
        hashSha256: createHash('sha256').update(archivo).digest('hex'),
      };
    } else if (dto.fecha !== undefined || dto.cedula !== undefined || dto.consecutivo !== undefined) {
      // El contenido no cambio, pero construirRutaArchivo organiza por
      // fecha/cedula/consecutivo (ver comentario en esa funcion) -- si
      // alguno de esos datos cambio, la carpeta donde vive el PDF quedaria
      // desincronizada del dato real (ej: sigue en "sin_fecha/" despues de
      // completar la fecha). Se mueve el mismo archivo a la ruta que le
      // corresponde ahora y se borra el de la ubicacion vieja: a diferencia
      // de reemplazar contenido o eliminar el documento, aca es el MISMO
      // archivo -- dejar los dos seria un duplicado inutil, no una copia de
      // seguridad (no se pierde nada borrando uno de los dos).
      const rutaEsperada = await this.construirRutaArchivo(consecutivoFinal, cedulaFinal, fechaFinal);
      if (rutaEsperada !== actual.archivoPath) {
        const bytesActuales = await this.storage.leer(actual.archivoPath);
        await this.storage.guardar(rutaEsperada, bytesActuales);
        await this.storage.eliminar(actual.archivoPath);
        datosArchivo = {
          archivoPath: rutaEsperada,
          tamanoBytes: actual.tamanoBytes ?? bytesActuales.length,
          hashSha256: actual.hashSha256 ?? createHash('sha256').update(bytesActuales).digest('hex'),
        };
        archivoReubicado = { anterior: actual.archivoPath, nuevo: rutaEsperada };
      }
    }

    const actualizado = await this.repo.actualizar(id, {
      personaId,
      ...(dto.consecutivo ? { consecutivo: dto.consecutivo, consecutivoNum: Number.parseInt(dto.consecutivo, 10) || null } : {}),
      ...(dto.fecha ? { fecha: new Date(dto.fecha) } : {}),
      ...(datosArchivo ?? {}),
      revisar: false,
      motivoRevisar: 'corregido_manual',
    });

    await this.auditoria.registrar({
      usuarioId,
      accion: 'editar',
      documentoId: id,
      detalle: {
        antes,
        despues: dto,
        ...(archivo && datosArchivo ? { archivo_reemplazado: { anterior: actual.archivoPath, nuevo: datosArchivo.archivoPath } } : {}),
        ...(archivoReubicado ? { archivo_reubicado: archivoReubicado } : {}),
      },
    });

    return actualizado;
  }

  async eliminar(id: number, usuarioId: number): Promise<Documento> {
    await this.detalle(id);
    const eliminado = await this.repo.softDelete(id);
    await this.auditoria.registrar({ usuarioId, accion: 'eliminar', documentoId: id });
    return eliminado;
  }

  // POST /documentos/:id/dividir: el documento original mezclaba varios
  // consecutivos en un solo PDF (el OCR no detecto el corte entre
  // facturas). Corta el PDF en las partes indicadas, crea un documento
  // nuevo por cada una (mismo chequeo de consecutivo duplicado que la
  // carga manual, excluyendo al propio original de esa comparacion) y
  // marca el original como eliminado -- su PDF tampoco se borra, mismo
  // criterio que actualizar()/eliminar().
  async dividir(id: number, dto: DividirDocumentoDto, usuarioId: number): Promise<Documento[]> {
    const original = await this.detalle(id);
    if (original.eliminadoEn) {
      throw new BadRequestException('Este documento ya esta eliminado');
    }

    const buffer = await this.storage.leer(original.archivoPath);
    const pdfOriginal = await PDFDocument.load(buffer, { updateMetadata: false });
    const totalPaginas = pdfOriginal.getPageCount();

    const partesOrdenadas = [...dto.partes].sort((a, b) => a.pagina_inicio - b.pagina_inicio);
    for (const parte of partesOrdenadas) {
      if (parte.pagina_inicio > parte.pagina_fin) {
        throw new BadRequestException(`Rango de paginas invalido: ${parte.pagina_inicio}-${parte.pagina_fin}`);
      }
      if (parte.pagina_fin > totalPaginas) {
        throw new BadRequestException(
          `El documento original tiene ${totalPaginas} paginas, pero se pidio hasta la ${parte.pagina_fin}`,
        );
      }
    }
    for (let i = 1; i < partesOrdenadas.length; i++) {
      if (partesOrdenadas[i].pagina_inicio <= partesOrdenadas[i - 1].pagina_fin) {
        throw new BadRequestException('Las paginas de las partes no pueden superponerse');
      }
    }

    const consecutivosVistos = new Set<string>();
    for (const parte of dto.partes) {
      if (consecutivosVistos.has(parte.consecutivo)) {
        throw new ConflictException(`El consecutivo ${parte.consecutivo} esta repetido entre las partes`);
      }
      consecutivosVistos.add(parte.consecutivo);
    }

    // Se validan todos los consecutivos ANTES de escribir ningun archivo o
    // fila -- si Promise.all rechaza (duplicado contra otro documento
    // activo), no queda nada a medio crear.
    const chequeos = await Promise.all(dto.partes.map((parte) => this.chequearConsecutivo(parte.consecutivo, id)));

    const creados: Documento[] = [];
    for (let i = 0; i < dto.partes.length; i++) {
      const parte = dto.partes[i];
      const { consecutivoNum, revisar, motivo } = chequeos[i];

      const fecha = parte.fecha ? new Date(parte.fecha) : original.fecha;
      const cedula = parte.cedula ?? original.persona?.cedula ?? null;
      const nombre = parte.nombre ?? original.persona?.nombre ?? null;
      const persona = await this.personas.getOrCreatePersona(cedula, nombre);

      const nuevoPdf = await PDFDocument.create();
      const indices = Array.from(
        { length: parte.pagina_fin - parte.pagina_inicio + 1 },
        (_, n) => parte.pagina_inicio - 1 + n,
      );
      const paginasCopiadas = await nuevoPdf.copyPages(pdfOriginal, indices);
      paginasCopiadas.forEach((p) => nuevoPdf.addPage(p));
      const bytesNuevoPdf = Buffer.from(await nuevoPdf.save());

      const rutaArchivo = await this.construirRutaArchivo(parte.consecutivo, cedula, fecha);
      await this.storage.guardar(rutaArchivo, bytesNuevoPdf);

      const documento = await this.repo.crear({
        libroId: original.libroId,
        origen: original.origen,
        personaId: persona?.id ?? null,
        consecutivo: parte.consecutivo,
        consecutivoNum,
        fecha,
        periodoLibro: original.periodoLibro,
        revisar,
        motivoRevisar: motivo,
        paginaInicio: original.paginaInicio,
        paginaFin: original.paginaFin,
        archivoPath: rutaArchivo,
        tamanoBytes: bytesNuevoPdf.length,
        hashSha256: createHash('sha256').update(bytesNuevoPdf).digest('hex'),
      });

      await this.auditoria.registrar({
        usuarioId,
        accion: 'dividir_documento',
        documentoId: documento.id,
        detalle: {
          documentoOriginalId: original.id,
          consecutivoOriginal: original.consecutivo,
          paginas: [parte.pagina_inicio, parte.pagina_fin],
        },
      });

      creados.push(documento);
    }

    await this.repo.softDelete(id);
    await this.auditoria.registrar({
      usuarioId,
      accion: 'eliminar',
      documentoId: id,
      detalle: { motivo: 'dividido', nuevos: creados.map((d) => ({ id: d.id, consecutivo: d.consecutivo })) },
    });

    return creados;
  }

  async listarConsecutivos(libroId?: number) {
    const docs = await this.repo.listarConsecutivos(libroId);
    return docs.map((d) => ({
      id: d.id,
      consecutivo: d.consecutivo,
      estado: d.revisar ? (d.motivoRevisar === 'consecutivo_repetido' ? 'duplicado' : 'revisar') : 'ok',
    }));
  }

  // Rango maximo razonable para un libro/lote real. Un solo consecutivo mal
  // leido por OCR (ej. "44000008" en vez de "4700") puede disparar el rango
  // a millones de numeros; sin este limite el for de abajo cuelga la API y
  // el navegador intenta renderizar millones de badges de "hueco".
  private static readonly RANGO_MAXIMO_HUECOS = 20000;

  // Detecta numeros faltantes en el rango [min, max] de consecutivoNum
  // (PLAN_API.md 7.1 "/documentos/consecutivos/huecos").
  async huecos(
    libroId?: number,
  ): Promise<{ rango: [number, number] | null; faltantes: number[]; demasiado_grande: boolean }> {
    const docs = await this.repo.listarConsecutivos(libroId);
    const nums = docs.map((d) => d.consecutivoNum).filter((n): n is number => n !== null);
    if (nums.length === 0) return { rango: null, faltantes: [], demasiado_grande: false };

    const presentes = new Set(nums);
    const min = Math.min(...nums);
    const max = Math.max(...nums);

    if (max - min > DocumentosService.RANGO_MAXIMO_HUECOS) {
      return { rango: [min, max], faltantes: [], demasiado_grande: true };
    }

    const faltantes: number[] = [];
    for (let n = min; n <= max; n++) {
      if (!presentes.has(n)) faltantes.push(n);
    }
    return { rango: [min, max], faltantes, demasiado_grande: false };
  }
}
