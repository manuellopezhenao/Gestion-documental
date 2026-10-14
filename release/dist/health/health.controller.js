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
Object.defineProperty(exports, "__esModule", { value: true });
exports.HealthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const prisma_service_1 = require("../prisma/prisma.service");
const storage_interface_1 = require("../storage/storage.interface");
let HealthController = class HealthController {
    constructor(prisma, storage) {
        this.prisma = prisma;
        this.storage = storage;
    }
    async estado() {
        const [dbOk, storageOk] = await Promise.all([this.chequearDb(), this.chequearStorage()]);
        const ok = dbOk && storageOk;
        return {
            estado: ok ? 'ok' : 'degradado',
            base_datos: dbOk ? 'ok' : 'error',
            storage: storageOk ? 'ok' : 'error',
        };
    }
    async chequearDb() {
        try {
            await this.prisma.$queryRaw `SELECT 1`;
            return true;
        }
        catch {
            return false;
        }
    }
    async chequearStorage() {
        try {
            await this.storage.existe('.');
            return true;
        }
        catch {
            return false;
        }
    }
};
exports.HealthController = HealthController;
__decorate([
    (0, common_1.Get)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], HealthController.prototype, "estado", null);
exports.HealthController = HealthController = __decorate([
    (0, swagger_1.ApiTags)('infraestructura'),
    (0, common_1.Controller)('api/v1/health'),
    __param(1, (0, common_1.Inject)(storage_interface_1.STORAGE_TOKEN)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, Object])
], HealthController);
//# sourceMappingURL=health.controller.js.map