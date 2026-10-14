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
var ProcesarLibroJob_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProcesarLibroJob = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const child_process_1 = require("child_process");
const crypto_1 = require("crypto");
const fs_1 = require("fs");
const path = __importStar(require("path"));
const prisma_service_1 = require("../../prisma/prisma.service");
const personas_service_1 = require("../../personas/personas.service");
const libros_repository_1 = require("../libros.repository");
const ocr_sqlite_client_1 = require("./ocr-sqlite.client");
let ProcesarLibroJob = ProcesarLibroJob_1 = class ProcesarLibroJob {
    constructor(configService, prisma, personas, librosRepo) {
        this.prisma = prisma;
        this.personas = personas;
        this.librosRepo = librosRepo;
        this.logger = new common_1.Logger(ProcesarLibroJob_1.name);
        this.config = configService.get('app');
        this.ocrDbPathAbs = path.resolve(process.cwd(), this.config.ocrDbPath);
        this.ocrScriptPathAbs = path.resolve(process.cwd(), this.config.ocrScriptPath);
        this.storageRoot = path.resolve(process.cwd(), this.config.storagePath);
        this.ocrDb = new ocr_sqlite_client_1.OcrSqliteClient(this.ocrDbPathAbs);
    }
    async ejecutar(libroId, pdfAbsolutoOrigen, startPage) {
        await this.librosRepo.actualizar(libroId, { estado: 'procesando', iniciadoEn: new Date() });
        const maxIdAntes = this.existeDbOcr() ? this.ocrDb.maxIdParaPdf(pdfAbsolutoOrigen) : 0;
        let cadenaImport = Promise.resolve(maxIdAntes);
        const encolarImport = () => {
            cadenaImport = cadenaImport.then(async (idAnterior) => {
                try {
                    return await this.importarNuevos(libroId, pdfAbsolutoOrigen, idAnterior);
                }
                catch (err) {
                    this.logger.warn(`Fallo un import incremental (se reintenta en el proximo ciclo): ${String(err)}`);
                    return idAnterior;
                }
            });
        };
        const intervalo = setInterval(encolarImport, ProcesarLibroJob_1.INTERVALO_IMPORT_MS);
        try {
            await this.correrScriptPython(pdfAbsolutoOrigen, startPage);
            clearInterval(intervalo);
            encolarImport();
            await cadenaImport;
            await this.librosRepo.actualizar(libroId, { estado: 'completado', finalizadoEn: new Date() });
        }
        catch (err) {
            clearInterval(intervalo);
            encolarImport();
            await cadenaImport.catch(() => { });
            const mensaje = err instanceof Error ? err.message : String(err);
            await this.librosRepo.actualizar(libroId, { estado: 'error', errorDetalle: mensaje, finalizadoEn: new Date() });
            this.logger.error(`Libro ${libroId} termino en error: ${mensaje}`);
        }
    }
    existeDbOcr() {
        return (0, fs_1.existsSync)(this.ocrDbPathAbs);
    }
    correrScriptPython(pdfAbsoluto, startPage) {
        return new Promise((resolve, reject) => {
            const args = [
                this.ocrScriptPathAbs,
                pdfAbsoluto,
                '--start-page',
                String(startPage),
                '--out',
                this.storageRoot,
            ];
            const proceso = (0, child_process_1.spawn)(this.config.pythonBin, args, { cwd: path.dirname(this.ocrScriptPathAbs) });
            let stderr = '';
            proceso.stderr.on('data', (chunk) => {
                stderr += chunk.toString();
            });
            proceso.stdout.on('data', () => { });
            proceso.on('error', (err) => reject(err));
            proceso.on('close', (code) => {
                if (code === 0)
                    resolve();
                else
                    reject(new Error(`split_consecutivos.py salio con codigo ${code}: ${stderr.slice(-2000)}`));
            });
        });
    }
    async importarNuevos(libroId, pdfOrigenAbsoluto, maxIdAntes) {
        const filas = this.ocrDb.documentosNuevos(pdfOrigenAbsoluto, maxIdAntes);
        if (filas.length === 0)
            return maxIdAntes;
        let consecutivoMin = null;
        let consecutivoMax = null;
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
        const libroActual = await this.librosRepo.porId(libroId);
        const minCombinado = consecutivoMin === null
            ? (libroActual?.consecutivoMin ?? null)
            : libroActual?.consecutivoMin != null
                ? Math.min(libroActual.consecutivoMin, consecutivoMin)
                : consecutivoMin;
        const maxCombinado = consecutivoMax === null
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
    async importarFila(libroId, fila) {
        const personaOcr = this.ocrDb.persona(fila.persona_id);
        const persona = await this.personas.getOrCreatePersona(personaOcr?.cedula ?? null, personaOcr?.nombre ?? null);
        const rutaRelativa = path.relative(this.storageRoot, fila.archivo).split(path.sep).join('/');
        const rutaAbsoluta = path.resolve(this.storageRoot, rutaRelativa);
        const bytes = await fs_1.promises.readFile(rutaAbsoluta);
        const hash = (0, crypto_1.createHash)('sha256').update(bytes).digest('hex');
        const fecha = fila.fecha ? this.parsearFechaSegura(fila.fecha.replace(/\//g, '-')) : null;
        const periodoLibro = fila.periodo_libro
            ? this.parsearFechaSegura(`${fila.periodo_libro.replace('/', '-')}-01`)
            : null;
        const consecutivoNum = Number.parseInt(fila.consecutivo, 10);
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
    parsearFechaSegura(valor) {
        const fecha = new Date(valor);
        return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
    async inferirMotivoRevisar(fila, personaOcr, consecutivoNum, fecha) {
        if (!fila.revisar) {
            if (!personaOcr?.cedula)
                return 'sin_cedula';
            if (!fecha)
                return 'sin_fecha';
            return null;
        }
        if (Number.isNaN(consecutivoNum))
            return 'consecutivo_fuera_de_tendencia';
        const duplicado = await this.prisma.documento.findFirst({
            where: { consecutivoNum, eliminadoEn: null },
        });
        return duplicado ? 'consecutivo_repetido' : 'consecutivo_fuera_de_tendencia';
    }
};
exports.ProcesarLibroJob = ProcesarLibroJob;
ProcesarLibroJob.INTERVALO_IMPORT_MS = 3000;
exports.ProcesarLibroJob = ProcesarLibroJob = ProcesarLibroJob_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        personas_service_1.PersonasService,
        libros_repository_1.LibrosRepository])
], ProcesarLibroJob);
//# sourceMappingURL=procesar-libro.job.js.map