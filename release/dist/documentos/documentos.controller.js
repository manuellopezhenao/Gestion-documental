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
exports.DocumentosController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../auth/jwt-auth.guard");
const roles_guard_1 = require("../auth/roles.guard");
const roles_decorator_1 = require("../auth/roles.decorator");
const usuario_actual_decorator_1 = require("../auth/usuario-actual.decorator");
const documentos_service_1 = require("./documentos.service");
const buscar_documentos_dto_1 = require("./dto/buscar-documentos.dto");
const crear_documento_manual_dto_1 = require("./dto/crear-documento-manual.dto");
const actualizar_documento_dto_1 = require("./dto/actualizar-documento.dto");
const dividir_documento_dto_1 = require("./dto/dividir-documento.dto");
let DocumentosController = class DocumentosController {
    constructor(documentos) {
        this.documentos = documentos;
    }
    buscar(filtros) {
        return this.documentos.buscar(filtros);
    }
    listarConsecutivos(libroId) {
        return this.documentos.listarConsecutivos(libroId ? Number(libroId) : undefined);
    }
    huecos(libroId) {
        return this.documentos.huecos(libroId ? Number(libroId) : undefined);
    }
    detalle(id) {
        return this.documentos.detalle(id);
    }
    async archivo(id, modo = 'attachment', usuario, res) {
        const { buffer, documento } = await this.documentos.obtenerArchivo(id, usuario.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${modo === 'inline' ? 'inline' : 'attachment'}; filename="${documento.consecutivo}.pdf"`);
        res.send(buffer);
    }
    crearManual(dto, archivo, usuario) {
        if (!archivo) {
            throw new common_1.BadRequestException('Falta el archivo PDF (campo "archivo")');
        }
        return this.documentos.crearManual(dto, archivo.buffer, usuario.id);
    }
    actualizar(id, dto, archivo, usuario) {
        return this.documentos.actualizar(id, dto, usuario.id, archivo?.buffer);
    }
    eliminar(id, usuario) {
        return this.documentos.eliminar(id, usuario.id);
    }
    dividir(id, dto, usuario) {
        return this.documentos.dividir(id, dto, usuario.id);
    }
    versiones(id) {
        return this.documentos.versiones(id);
    }
    async archivoVersion(id, indice, modo = 'attachment', usuario, res) {
        const { buffer, documento, version } = await this.documentos.archivoVersion(id, indice, usuario.id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `${modo === 'inline' ? 'inline' : 'attachment'}; filename="${documento.consecutivo}_v${version.indice}.pdf"`);
        res.send(buffer);
    }
};
exports.DocumentosController = DocumentosController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [buscar_documentos_dto_1.BuscarDocumentosDto]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "buscar", null);
__decorate([
    (0, common_1.Get)('consecutivos'),
    __param(0, (0, common_1.Query)('libro_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "listarConsecutivos", null);
__decorate([
    (0, common_1.Get)('consecutivos/huecos'),
    __param(0, (0, common_1.Query)('libro_id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "huecos", null);
__decorate([
    (0, common_1.Get)(':id'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "detalle", null);
__decorate([
    (0, common_1.Get)(':id/archivo'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Query)('modo')),
    __param(2, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __param(3, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentosController.prototype, "archivo", null);
__decorate([
    (0, common_1.Post)(),
    (0, roles_decorator_1.Roles)('editor', 'admin'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('archivo')),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.UploadedFile)()),
    __param(2, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [crear_documento_manual_dto_1.CrearDocumentoManualDto, Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "crearManual", null);
__decorate([
    (0, common_1.Patch)(':id'),
    (0, roles_decorator_1.Roles)('editor', 'admin'),
    (0, swagger_1.ApiConsumes)('multipart/form-data'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('archivo')),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.UploadedFile)()),
    __param(3, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, actualizar_documento_dto_1.ActualizarDocumentoDto, Object, Object]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "actualizar", null);
__decorate([
    (0, common_1.Delete)(':id'),
    (0, roles_decorator_1.Roles)('admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Object]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "eliminar", null);
__decorate([
    (0, common_1.Post)(':id/dividir'),
    (0, roles_decorator_1.Roles)('editor', 'admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, dividir_documento_dto_1.DividirDocumentoDto, Object]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "dividir", null);
__decorate([
    (0, common_1.Get)(':id/versiones'),
    (0, roles_decorator_1.Roles)('editor', 'admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", void 0)
], DocumentosController.prototype, "versiones", null);
__decorate([
    (0, common_1.Get)(':id/versiones/:indice/archivo'),
    (0, roles_decorator_1.Roles)('editor', 'admin'),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Param)('indice', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Query)('modo')),
    __param(3, (0, usuario_actual_decorator_1.UsuarioActual)()),
    __param(4, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, Object, Object]),
    __metadata("design:returntype", Promise)
], DocumentosController.prototype, "archivoVersion", null);
exports.DocumentosController = DocumentosController = __decorate([
    (0, swagger_1.ApiTags)('documentos'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('api/v1/documentos'),
    __metadata("design:paramtypes", [documentos_service_1.DocumentosService])
], DocumentosController);
//# sourceMappingURL=documentos.controller.js.map