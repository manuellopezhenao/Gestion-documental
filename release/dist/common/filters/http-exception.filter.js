"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HttpExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
let HttpExceptionFilter = class HttpExceptionFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let error = 'error_interno';
        let mensaje = 'Ocurrio un error inesperado';
        let detalle = null;
        if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            if (typeof body === 'string') {
                mensaje = body;
            }
            else if (typeof body === 'object' && body !== null) {
                const b = body;
                mensaje = b.message ?? exception.message;
                detalle = b.detalle ?? (Array.isArray(b.message) ? b.message : null);
            }
            error = codigoPorStatus(status);
        }
        else if (exception instanceof Error) {
            mensaje = exception.message;
        }
        response.status(status).json({ error, mensaje, detalle });
    }
};
exports.HttpExceptionFilter = HttpExceptionFilter;
exports.HttpExceptionFilter = HttpExceptionFilter = __decorate([
    (0, common_1.Catch)()
], HttpExceptionFilter);
function codigoPorStatus(status) {
    switch (status) {
        case common_1.HttpStatus.BAD_REQUEST:
            return 'validacion';
        case common_1.HttpStatus.UNAUTHORIZED:
            return 'sin_autenticar';
        case common_1.HttpStatus.FORBIDDEN:
            return 'sin_permiso';
        case common_1.HttpStatus.NOT_FOUND:
            return 'no_encontrado';
        case common_1.HttpStatus.CONFLICT:
            return 'conflicto';
        case common_1.HttpStatus.UNPROCESSABLE_ENTITY:
            return 'error_negocio';
        default:
            return 'error_interno';
    }
}
//# sourceMappingURL=http-exception.filter.js.map