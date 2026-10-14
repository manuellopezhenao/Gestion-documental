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
exports.BuscarDocumentosDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const aBooleano = ({ value }) => {
    if (value === undefined || value === '')
        return undefined;
    return value === true || value === 'true' || value === '1';
};
class BuscarDocumentosDto {
    constructor() {
        this.page = 1;
        this.page_size = 50;
        this.orden_por = 'procesado_en';
        this.orden = 'desc';
    }
}
exports.BuscarDocumentosDto = BuscarDocumentosDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "consecutivo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BuscarDocumentosDto.prototype, "consecutivo_desde", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BuscarDocumentosDto.prototype, "consecutivo_hasta", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "cedula", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "nombre", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'YYYY-MM-DD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "fecha_desde", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'YYYY-MM-DD' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "fecha_hasta", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'YYYY-MM' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "periodo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], BuscarDocumentosDto.prototype, "libro_id", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(aBooleano),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BuscarDocumentosDto.prototype, "revisar", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "motivo_revisar", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Transform)(aBooleano),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], BuscarDocumentosDto.prototype, "incluir_eliminados", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Busqueda libre: consecutivo, cedula o nombre' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "q", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 1 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BuscarDocumentosDto.prototype, "page", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: 50 }),
    (0, class_validator_1.IsOptional)(),
    (0, class_transformer_1.Type)(() => Number),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], BuscarDocumentosDto.prototype, "page_size", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['consecutivo', 'fecha', 'procesado_en'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['consecutivo', 'fecha', 'procesado_en']),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "orden_por", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['asc', 'desc'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['asc', 'desc']),
    __metadata("design:type", String)
], BuscarDocumentosDto.prototype, "orden", void 0);
//# sourceMappingURL=buscar-documentos.dto.js.map