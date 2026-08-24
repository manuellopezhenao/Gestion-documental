import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';

// Formato de error estandar de toda la API (ver PLAN_API.md seccion 7.7):
// { "error": "codigo_snake_case", "mensaje": "...", "detalle": null }
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let error = 'error_interno';
    let mensaje = 'Ocurrio un error inesperado';
    let detalle: unknown = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'string') {
        mensaje = body;
      } else if (typeof body === 'object' && body !== null) {
        const b = body as Record<string, unknown>;
        mensaje = (b.message as string) ?? exception.message;
        detalle = b.detalle ?? (Array.isArray(b.message) ? b.message : null);
      }
      error = codigoPorStatus(status);
    } else if (exception instanceof Error) {
      mensaje = exception.message;
    }

    response.status(status).json({ error, mensaje, detalle });
  }
}

function codigoPorStatus(status: number): string {
  switch (status) {
    case HttpStatus.BAD_REQUEST:
      return 'validacion';
    case HttpStatus.UNAUTHORIZED:
      return 'sin_autenticar';
    case HttpStatus.FORBIDDEN:
      return 'sin_permiso';
    case HttpStatus.NOT_FOUND:
      return 'no_encontrado';
    case HttpStatus.CONFLICT:
      return 'conflicto';
    case HttpStatus.UNPROCESSABLE_ENTITY:
      return 'error_negocio';
    default:
      return 'error_interno';
  }
}
