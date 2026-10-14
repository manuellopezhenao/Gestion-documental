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
exports.PersonasService = void 0;
const common_1 = require("@nestjs/common");
const personas_repository_1 = require("./personas.repository");
const prisma_service_1 = require("../prisma/prisma.service");
let PersonasService = class PersonasService {
    constructor(repo, prisma) {
        this.repo = repo;
        this.prisma = prisma;
    }
    async getOrCreatePersona(cedula, nombre) {
        if (!cedula)
            return null;
        const existente = await this.repo.porCedula(cedula);
        if (existente) {
            if (nombre && !existente.nombre) {
                return this.repo.actualizarNombre(existente.id, nombre);
            }
            return existente;
        }
        return this.repo.crear(cedula, nombre);
    }
    async buscar(q, page, pageSize) {
        const [resultados, total] = await this.repo.listar({ q, page, pageSize });
        return { total, page, page_size: pageSize, resultados };
    }
    async detalle(id) {
        const persona = await this.repo.porId(id);
        if (!persona)
            throw new common_1.NotFoundException(`No existe la persona con id ${id}`);
        return persona;
    }
    async documentosDe(id) {
        await this.detalle(id);
        return this.prisma.documento.findMany({
            where: { personaId: id, eliminadoEn: null },
            orderBy: { procesadoEn: 'desc' },
            include: { libro: true },
        });
    }
};
exports.PersonasService = PersonasService;
exports.PersonasService = PersonasService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [personas_repository_1.PersonasRepository,
        prisma_service_1.PrismaService])
], PersonasService);
//# sourceMappingURL=personas.service.js.map