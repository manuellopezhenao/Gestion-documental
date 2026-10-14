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
exports.LibrosRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let LibrosRepository = class LibrosRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    crear(data) {
        return this.prisma.libro.create({ data });
    }
    porId(id) {
        return this.prisma.libro.findUnique({ where: { id } });
    }
    actualizar(id, data) {
        return this.prisma.libro.update({ where: { id }, data });
    }
    listar() {
        return this.prisma.libro.findMany({ orderBy: { id: 'desc' } });
    }
    listarPorEstado(estado) {
        return this.prisma.libro.findMany({ where: { estado } });
    }
    documentosDe(libroId) {
        return this.prisma.documento.findMany({
            where: { libroId, eliminadoEn: null },
            include: { persona: true },
            orderBy: { consecutivoNum: 'asc' },
        });
    }
    todosLosDocumentosDe(libroId) {
        return this.prisma.documento.findMany({ where: { libroId } });
    }
    async eliminarConDocumentos(libroId) {
        await this.prisma.$transaction([
            this.prisma.documento.deleteMany({ where: { libroId } }),
            this.prisma.libro.delete({ where: { id: libroId } }),
        ]);
    }
};
exports.LibrosRepository = LibrosRepository;
exports.LibrosRepository = LibrosRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LibrosRepository);
//# sourceMappingURL=libros.repository.js.map