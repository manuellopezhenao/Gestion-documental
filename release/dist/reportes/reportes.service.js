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
exports.ReportesService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
let ReportesService = class ReportesService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async resumen() {
        const [totalDocumentos, pendientesRevisar, personasSinCedula, librosConError, porMes] = await Promise.all([
            this.prisma.documento.count({ where: { eliminadoEn: null } }),
            this.prisma.documento.count({ where: { eliminadoEn: null, revisar: true } }),
            this.prisma.persona.count({ where: { cedula: null } }),
            this.prisma.libro.count({ where: { estado: 'error' } }),
            this.prisma.$queryRaw `
        SELECT strftime('%Y-%m', COALESCE(fecha, periodo_libro) / 1000, 'unixepoch') AS mes, COUNT(*) AS total
        FROM documentos
        WHERE eliminado_en IS NULL
        GROUP BY mes
        ORDER BY mes DESC
        LIMIT 12
      `,
        ]);
        return {
            total_documentos: totalDocumentos,
            pendientes_revisar: pendientesRevisar,
            personas_sin_cedula: personasSinCedula,
            libros_con_errores: librosConError,
            documentos_por_mes: porMes.map((fila) => ({ mes: fila.mes, total: Number(fila.total) })),
        };
    }
};
exports.ReportesService = ReportesService;
exports.ReportesService = ReportesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], ReportesService);
//# sourceMappingURL=reportes.service.js.map