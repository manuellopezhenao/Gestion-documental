"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var LibrosService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LibrosService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const pdf_lib_1 = require("pdf-lib");
const path = __importStar(require("path"));
const storage_interface_1 = require("../storage/storage.interface");
const auditoria_service_1 = require("../auditoria/auditoria.service");
const libros_repository_1 = require("./libros.repository");
const procesar_libro_job_1 = require("./jobs/procesar-libro.job");
const MESES = {
    ENERO: '01', FEBRERO: '02', MARZO: '03', ABRIL: '04', MAYO: '05', JUNIO: '06',
    JULIO: '07', AGOSTO: '08', SEPTIEMBRE: '09', SETIEMBRE: '09', OCTUBRE: '10',
    NOVIEMBRE: '11', DICIEMBRE: '12',
};
function parsePeriodoLibro(nombreArchivo) {
    const nombre = nombreArchivo.toUpperCase();
    const anio = nombre.match(/(20\d{2})/)?.[1];
    const mes = Object.entries(MESES).find(([nombreMes]) => nombre.includes(nombreMes))?.[1];
    if (anio && mes)
        return new Date(Date.UTC(Number(anio), Number(mes) - 1, 1));
    return null;
}
let LibrosService = LibrosService_1 = class LibrosService {
    constructor(repo, auditoria, job, configService, storage) {
        this.repo = repo;
        this.auditoria = auditoria;
        this.job = job;
        this.storage = storage;
        this.logger = new common_1.Logger(LibrosService_1.name);
        this.storageRoot = path.resolve(process.cwd(), configService.get('app').storagePath);
    }
    async onModuleInit() {
        const huerfanos = await this.repo.listarPorEstado('procesando');
        for (const libro of huerfanos) {
            await this.repo.actualizar(libro.id, {
                estado: 'error',
                errorDetalle: 'El servidor se reinicio mientras este libro estaba procesando y el job se perdio. Usa "Reanudar" para continuar desde la ultima pagina completada, o "Eliminar libro" para descartarlo.',
                finalizadoEn: new Date(),
            });
            this.logger.warn(`Libro ${libro.id} quedo huerfano en 'procesando' tras un reinicio - marcado como error`);
        }
    }
    listar() {
        return this.repo.listar();
    }
    async detalle(id) {
        const libro = await this.repo.porId(id);
        if (!libro)
            throw new common_1.NotFoundException(`No existe el libro con id ${id}`);
        return libro;
    }
    documentosDe(id) {
        return this.repo.documentosDe(id);
    }
    async subirLibro(nombreArchivo, archivo, usuarioId) {
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
    async estado(id) {
        return this.detalle(id);
    }
    async reanudar(id, usuarioId) {
        const libro = await this.detalle(id);
        if (libro.estado !== 'error') {
            throw new common_1.BadRequestException(`Solo se puede reanudar un libro en estado 'error' (actual: '${libro.estado}')`);
        }
        const documentos = await this.repo.documentosDe(id);
        const ultimaPagina = documentos.reduce((max, d) => Math.max(max, d.paginaFin), -1);
        const startPage = ultimaPagina + 1;
        await this.auditoria.registrar({ usuarioId, accion: 'reanudar_libro', detalle: { libroId: id, startPage } });
        const rutaAbsoluta = path.resolve(this.storageRoot, libro.rutaOrigen);
        void this.job.ejecutar(id, rutaAbsoluta, startPage);
        return this.detalle(id);
    }
    async eliminar(id, usuarioId) {
        const libro = await this.detalle(id);
        if (libro.estado === 'procesando') {
            throw new common_1.BadRequestException('No se puede eliminar un libro mientras esta procesando. Espera a que termine o falle primero.');
        }
        const documentos = await this.repo.todosLosDocumentosDe(id);
        for (const documento of documentos) {
            try {
                await this.storage.eliminar(documento.archivoPath);
            }
            catch {
            }
        }
        try {
            await this.storage.eliminar(libro.rutaOrigen);
        }
        catch {
        }
        await this.repo.eliminarConDocumentos(id);
        await this.auditoria.registrar({
            usuarioId,
            accion: 'eliminar_libro',
            detalle: { libroId: id, nombreArchivo: libro.nombreArchivo, documentosEliminados: documentos.length },
        });
        return { ok: true, documentosEliminados: documentos.length };
    }
    async contarPaginas(archivo) {
        try {
            const pdf = await pdf_lib_1.PDFDocument.load(archivo, { updateMetadata: false });
            return pdf.getPageCount();
        }
        catch {
            return null;
        }
    }
};
exports.LibrosService = LibrosService;
exports.LibrosService = LibrosService = LibrosService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(4, (0, common_1.Inject)(storage_interface_1.STORAGE_TOKEN)),
    __metadata("design:paramtypes", [libros_repository_1.LibrosRepository,
        auditoria_service_1.AuditoriaService,
        procesar_libro_job_1.ProcesarLibroJob,
        config_1.ConfigService, Object])
], LibrosService);
//# sourceMappingURL=libros.service.js.map