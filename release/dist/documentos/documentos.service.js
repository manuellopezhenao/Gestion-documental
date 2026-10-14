"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var DocumentosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentosService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const pdf_lib_1 = require("pdf-lib");
const documentos_repository_1 = require("./documentos.repository");
const personas_service_1 = require("../personas/personas.service");
const auditoria_service_1 = require("../auditoria/auditoria.service");
const storage_interface_1 = require("../storage/storage.interface");
let DocumentosService = DocumentosService_1 = class DocumentosService {
    constructor(repo, personas, auditoria, storage) {
        this.repo = repo;
        this.personas = personas;
        this.auditoria = auditoria;
        this.storage = storage;
    }
    async buscar(filtros) {
        const [resultados, total] = await this.repo.buscar(filtros);
        return { total, page: filtros.page ?? 1, page_size: filtros.page_size ?? 50, resultados };
    }
    async detalle(id) {
        const doc = await this.repo.porId(id);
        if (!doc)
            throw new common_1.NotFoundException(`No existe el documento con id ${id}`);
        return doc;
    }
    async obtenerArchivo(id, usuarioId) {
        const documento = await this.detalle(id);
        const buffer = await this.storage.leer(documento.archivoPath);
        await this.auditoria.registrar({ usuarioId, accion: 'descargar', documentoId: id });
        return { buffer, documento };
    }
    async calcularVersiones(id) {
        const documento = await this.detalle(id);
        const historial = await this.auditoria.buscar({ documento_id: id, accion: 'editar', page_size: 500 });
        const eventos = historial.resultados
            .map((r) => {
            const detalle = r.detalle;
            return detalle?.archivo_reemplazado
                ? { fecha: new Date(r.fecha), usuario: r.usuario, anterior: detalle.archivo_reemplazado.anterior }
                : null;
        })
            .filter((e) => e !== null);
        let usuarioOriginal = null;
        if (documento.origen === 'manual') {
            const creacion = await this.auditoria.buscar({ documento_id: id, accion: 'subir_documento_manual', page_size: 1 });
            usuarioOriginal = creacion.resultados[0]?.usuario ?? null;
        }
        const totalVersiones = eventos.length + 1;
        const versiones = [];
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
    async versiones(id) {
        const versiones = await this.calcularVersiones(id);
        return versiones.map(({ archivoPath: _archivoPath, ...resto }) => resto);
    }
    async archivoVersion(id, indice, usuarioId) {
        const documento = await this.detalle(id);
        const versiones = await this.calcularVersiones(id);
        const version = versiones[indice];
        if (!version)
            throw new common_1.NotFoundException(`No existe la version ${indice} de este documento`);
        const buffer = await this.storage.leer(version.archivoPath);
        await this.auditoria.registrar({
            usuarioId,
            accion: 'descargar',
            documentoId: id,
            detalle: { version: indice, vigente: version.vigente },
        });
        return { buffer, documento, version };
    }
    async chequearConsecutivo(consecutivo, excluirId) {
        const num = Number.parseInt(consecutivo, 10);
        if (Number.isNaN(num)) {
            return { consecutivoNum: null, revisar: true, motivo: 'consecutivo_no_numerico' };
        }
        const duplicado = await this.repo.existeConsecutivo(num, excluirId);
        if (duplicado) {
            throw new common_1.ConflictException(`Ya existe un documento activo con el consecutivo ${consecutivo}`);
        }
        return { consecutivoNum: num, revisar: false, motivo: null };
    }
    async construirRutaArchivo(consecutivo, cedula, fecha) {
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
    async crearManual(dto, archivo, usuarioId) {
        const fecha = dto.fecha ? new Date(dto.fecha) : null;
        const cedula = dto.cedula ?? null;
        const nombre = dto.nombre ?? null;
        const persona = await this.personas.getOrCreatePersona(cedula, nombre);
        const { consecutivoNum, revisar, motivo } = await this.chequearConsecutivo(dto.consecutivo);
        const rutaArchivo = await this.construirRutaArchivo(dto.consecutivo, cedula, fecha);
        await this.storage.guardar(rutaArchivo, archivo);
        const hash = (0, crypto_1.createHash)('sha256').update(archivo).digest('hex');
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
    async actualizar(id, dto, usuarioId, archivo) {
        const actual = await this.detalle(id);
        let personaId = actual.personaId;
        if (dto.cedula) {
            const persona = await this.personas.getOrCreatePersona(dto.cedula, dto.nombre ?? null);
            personaId = persona?.id ?? null;
        }
        else if (dto.nombre && actual.personaId) {
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
        let datosArchivo = null;
        let archivoReubicado = null;
        if (archivo) {
            const rutaArchivo = await this.construirRutaArchivo(consecutivoFinal, cedulaFinal, fechaFinal);
            await this.storage.guardar(rutaArchivo, archivo);
            datosArchivo = {
                archivoPath: rutaArchivo,
                tamanoBytes: archivo.length,
                hashSha256: (0, crypto_1.createHash)('sha256').update(archivo).digest('hex'),
            };
        }
        else if (dto.fecha !== undefined || dto.cedula !== undefined || dto.consecutivo !== undefined) {
            const rutaEsperada = await this.construirRutaArchivo(consecutivoFinal, cedulaFinal, fechaFinal);
            if (rutaEsperada !== actual.archivoPath) {
                const bytesActuales = await this.storage.leer(actual.archivoPath);
                await this.storage.guardar(rutaEsperada, bytesActuales);
                await this.storage.eliminar(actual.archivoPath);
                datosArchivo = {
                    archivoPath: rutaEsperada,
                    tamanoBytes: actual.tamanoBytes ?? bytesActuales.length,
                    hashSha256: actual.hashSha256 ?? (0, crypto_1.createHash)('sha256').update(bytesActuales).digest('hex'),
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
    async eliminar(id, usuarioId) {
        await this.detalle(id);
        const eliminado = await this.repo.softDelete(id);
        await this.auditoria.registrar({ usuarioId, accion: 'eliminar', documentoId: id });
        return eliminado;
    }
    async dividir(id, dto, usuarioId) {
        const original = await this.detalle(id);
        if (original.eliminadoEn) {
            throw new common_1.BadRequestException('Este documento ya esta eliminado');
        }
        const buffer = await this.storage.leer(original.archivoPath);
        const pdfOriginal = await pdf_lib_1.PDFDocument.load(buffer, { updateMetadata: false });
        const totalPaginas = pdfOriginal.getPageCount();
        const partesOrdenadas = [...dto.partes].sort((a, b) => a.pagina_inicio - b.pagina_inicio);
        for (const parte of partesOrdenadas) {
            if (parte.pagina_inicio > parte.pagina_fin) {
                throw new common_1.BadRequestException(`Rango de paginas invalido: ${parte.pagina_inicio}-${parte.pagina_fin}`);
            }
            if (parte.pagina_fin > totalPaginas) {
                throw new common_1.BadRequestException(`El documento original tiene ${totalPaginas} paginas, pero se pidio hasta la ${parte.pagina_fin}`);
            }
        }
        for (let i = 1; i < partesOrdenadas.length; i++) {
            if (partesOrdenadas[i].pagina_inicio <= partesOrdenadas[i - 1].pagina_fin) {
                throw new common_1.BadRequestException('Las paginas de las partes no pueden superponerse');
            }
        }
        const consecutivosVistos = new Set();
        for (const parte of dto.partes) {
            if (consecutivosVistos.has(parte.consecutivo)) {
                throw new common_1.ConflictException(`El consecutivo ${parte.consecutivo} esta repetido entre las partes`);
            }
            consecutivosVistos.add(parte.consecutivo);
        }
        const chequeos = await Promise.all(dto.partes.map((parte) => this.chequearConsecutivo(parte.consecutivo, id)));
        const creados = [];
        for (let i = 0; i < dto.partes.length; i++) {
            const parte = dto.partes[i];
            const { consecutivoNum, revisar, motivo } = chequeos[i];
            const fecha = parte.fecha ? new Date(parte.fecha) : original.fecha;
            const cedula = parte.cedula ?? original.persona?.cedula ?? null;
            const nombre = parte.nombre ?? original.persona?.nombre ?? null;
            const persona = await this.personas.getOrCreatePersona(cedula, nombre);
            const nuevoPdf = await pdf_lib_1.PDFDocument.create();
            const indices = Array.from({ length: parte.pagina_fin - parte.pagina_inicio + 1 }, (_, n) => parte.pagina_inicio - 1 + n);
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
                hashSha256: (0, crypto_1.createHash)('sha256').update(bytesNuevoPdf).digest('hex'),
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
    async listarConsecutivos(libroId) {
        const docs = await this.repo.listarConsecutivos(libroId);
        return docs.map((d) => ({
            id: d.id,
            consecutivo: d.consecutivo,
            estado: d.revisar ? (d.motivoRevisar === 'consecutivo_repetido' ? 'duplicado' : 'revisar') : 'ok',
        }));
    }
    async huecos(libroId) {
        const docs = await this.repo.listarConsecutivos(libroId);
        const nums = docs.map((d) => d.consecutivoNum).filter((n) => n !== null);
        if (nums.length === 0)
            return { rango: null, faltantes: [], demasiado_grande: false };
        const presentes = new Set(nums);
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        if (max - min > DocumentosService_1.RANGO_MAXIMO_HUECOS) {
            return { rango: [min, max], faltantes: [], demasiado_grande: true };
        }
        const faltantes = [];
        for (let n = min; n <= max; n++) {
            if (!presentes.has(n))
                faltantes.push(n);
        }
        return { rango: [min, max], faltantes, demasiado_grande: false };
    }
};
exports.DocumentosService = DocumentosService;
DocumentosService.RANGO_MAXIMO_HUECOS = 20000;
exports.DocumentosService = DocumentosService = DocumentosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(3, (0, common_1.Inject)(storage_interface_1.STORAGE_TOKEN)),
    __metadata("design:paramtypes", [documentos_repository_1.DocumentosRepository,
        personas_service_1.PersonasService,
        auditoria_service_1.AuditoriaService, Object])
], DocumentosService);
//# sourceMappingURL=documentos.service.js.map