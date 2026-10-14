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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentosRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const INCLUDE_RELACIONES = { persona: true, libro: true };
let DocumentosRepository = class DocumentosRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    construirWhere(filtros) {
        const where = {};
        if (!filtros.incluir_eliminados) {
            where.eliminadoEn = null;
        }
        if (filtros.consecutivo) {
            where.consecutivo = filtros.consecutivo;
        }
        if (filtros.consecutivo_desde !== undefined || filtros.consecutivo_hasta !== undefined) {
            where.consecutivoNum = {
                ...(filtros.consecutivo_desde !== undefined ? { gte: filtros.consecutivo_desde } : {}),
                ...(filtros.consecutivo_hasta !== undefined ? { lte: filtros.consecutivo_hasta } : {}),
            };
        }
        if (filtros.libro_id !== undefined) {
            where.libroId = filtros.libro_id;
        }
        if (filtros.revisar !== undefined) {
            where.revisar = filtros.revisar;
        }
        if (filtros.motivo_revisar) {
            where.motivoRevisar = filtros.motivo_revisar;
        }
        if (filtros.fecha_desde || filtros.fecha_hasta) {
            where.fecha = {
                ...(filtros.fecha_desde ? { gte: new Date(filtros.fecha_desde) } : {}),
                ...(filtros.fecha_hasta ? { lte: new Date(filtros.fecha_hasta) } : {}),
            };
        }
        if (filtros.periodo) {
            const [inicio, fin] = rangoDePeriodo(filtros.periodo);
            where.OR = [
                { fecha: { gte: inicio, lt: fin } },
                { AND: [{ fecha: null }, { periodoLibro: { gte: inicio, lt: fin } }] },
            ];
        }
        if (filtros.cedula || filtros.nombre) {
            where.persona = {
                ...(filtros.cedula ? { cedula: filtros.cedula } : {}),
                ...(filtros.nombre ? { nombre: { contains: filtros.nombre } } : {}),
            };
        }
        if (filtros.q) {
            const q = filtros.q;
            where.AND = [
                ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
                {
                    OR: [
                        { consecutivo: { contains: q } },
                        { persona: { cedula: { contains: q } } },
                        { persona: { nombre: { contains: q } } },
                    ],
                },
            ];
        }
        return where;
    }
    ordenarPor(filtros) {
        const direccion = filtros.orden ?? 'desc';
        switch (filtros.orden_por) {
            case 'consecutivo':
                return { consecutivoNum: direccion };
            case 'fecha':
                return { fecha: direccion };
            default:
                return { procesadoEn: direccion };
        }
    }
    async buscar(filtros) {
        const where = this.construirWhere(filtros);
        const page = filtros.page ?? 1;
        const pageSize = filtros.page_size ?? 50;
        return this.prisma.$transaction([
            this.prisma.documento.findMany({
                where,
                include: INCLUDE_RELACIONES,
                orderBy: this.ordenarPor(filtros),
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.documento.count({ where }),
        ]);
    }
    porId(id) {
        return this.prisma.documento.findFirst({
            where: { id },
            include: INCLUDE_RELACIONES,
        });
    }
    crear(data) {
        return this.prisma.documento.create({ data });
    }
    actualizar(id, data) {
        return this.prisma.documento.update({ where: { id }, data });
    }
    softDelete(id) {
        return this.prisma.documento.update({ where: { id }, data: { eliminadoEn: new Date() } });
    }
    async existeConsecutivo(consecutivoNum, excluirId) {
        const doc = await this.prisma.documento.findFirst({
            where: { consecutivoNum, eliminadoEn: null, ...(excluirId ? { id: { not: excluirId } } : {}) },
            select: { id: true },
        });
        return doc !== null;
    }
    async listarConsecutivos(libroId) {
        return this.prisma.documento.findMany({
            where: { eliminadoEn: null, ...(libroId ? { libroId } : {}) },
            select: { id: true, consecutivo: true, consecutivoNum: true, revisar: true, motivoRevisar: true },
            orderBy: { consecutivoNum: 'asc' },
        });
    }
};
exports.DocumentosRepository = DocumentosRepository;
exports.DocumentosRepository = DocumentosRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], DocumentosRepository);
function rangoDePeriodo(periodo) {
    const [anio, mes] = periodo.split('-').map(Number);
    const inicio = new Date(Date.UTC(anio, mes - 1, 1));
    const fin = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1));
    return [inicio, fin];
}
//# sourceMappingURL=documentos.repository.js.map