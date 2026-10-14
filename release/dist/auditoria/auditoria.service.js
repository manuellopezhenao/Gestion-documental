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
exports.AuditoriaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let AuditoriaService = class AuditoriaService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async registrar(params) {
        await this.prisma.auditoria.create({
            data: {
                usuarioId: params.usuarioId,
                accion: params.accion,
                documentoId: params.documentoId ?? null,
                detalle: params.detalle ? JSON.stringify(params.detalle) : null,
            },
        });
    }
    async buscar(filtros) {
        const where = {};
        if (filtros.accion)
            where.accion = filtros.accion;
        if (filtros.usuario_id !== undefined)
            where.usuarioId = filtros.usuario_id;
        if (filtros.documento_id !== undefined)
            where.documentoId = filtros.documento_id;
        if (filtros.fecha_desde || filtros.fecha_hasta) {
            where.fecha = {
                ...(filtros.fecha_desde ? { gte: new Date(filtros.fecha_desde) } : {}),
                ...(filtros.fecha_hasta ? { lte: new Date(`${filtros.fecha_hasta}T23:59:59.999`) } : {}),
            };
        }
        const page = filtros.page ?? 1;
        const pageSize = filtros.page_size ?? 50;
        const [filas, total] = await this.prisma.$transaction([
            this.prisma.auditoria.findMany({
                where,
                orderBy: { fecha: 'desc' },
                skip: (page - 1) * pageSize,
                take: pageSize,
            }),
            this.prisma.auditoria.count({ where }),
        ]);
        const usuarioIds = [...new Set(filas.map((f) => f.usuarioId).filter((id) => id !== null))];
        const documentoIds = [...new Set(filas.map((f) => f.documentoId).filter((id) => id !== null))];
        const [usuarios, documentos] = await Promise.all([
            usuarioIds.length
                ? this.prisma.usuario.findMany({ where: { id: { in: usuarioIds } }, select: { id: true, email: true, rol: true } })
                : Promise.resolve([]),
            documentoIds.length
                ? this.prisma.documento.findMany({ where: { id: { in: documentoIds } }, select: { id: true, consecutivo: true } })
                : Promise.resolve([]),
        ]);
        const usuariosPorId = new Map(usuarios.map((u) => [u.id, u]));
        const documentosPorId = new Map(documentos.map((d) => [d.id, d]));
        const resultados = filas.map((f) => ({
            id: f.id,
            accion: f.accion,
            fecha: f.fecha,
            detalle: f.detalle ? JSON.parse(f.detalle) : null,
            usuario: f.usuarioId !== null ? (usuariosPorId.get(f.usuarioId) ?? null) : null,
            documento: f.documentoId !== null ? (documentosPorId.get(f.documentoId) ?? null) : null,
        }));
        return { total, page, page_size: pageSize, resultados };
    }
};
exports.AuditoriaService = AuditoriaService;
exports.AuditoriaService = AuditoriaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AuditoriaService);
//# sourceMappingURL=auditoria.service.js.map