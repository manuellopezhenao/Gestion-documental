"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const configuration_1 = __importDefault(require("./config/configuration"));
const prisma_module_1 = require("./prisma/prisma.module");
const storage_module_1 = require("./storage/storage.module");
const auditoria_module_1 = require("./auditoria/auditoria.module");
const auth_module_1 = require("./auth/auth.module");
const documentos_module_1 = require("./documentos/documentos.module");
const personas_module_1 = require("./personas/personas.module");
const libros_module_1 = require("./libros/libros.module");
const reportes_module_1 = require("./reportes/reportes.module");
const health_module_1 = require("./health/health.module");
const sistema_module_1 = require("./sistema/sistema.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule.forRoot({ isGlobal: true, load: [configuration_1.default] }),
            prisma_module_1.PrismaModule,
            storage_module_1.StorageModule,
            auditoria_module_1.AuditoriaModule,
            auth_module_1.AuthModule,
            personas_module_1.PersonasModule,
            documentos_module_1.DocumentosModule,
            libros_module_1.LibrosModule,
            reportes_module_1.ReportesModule,
            health_module_1.HealthModule,
            sistema_module_1.SistemaModule,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map