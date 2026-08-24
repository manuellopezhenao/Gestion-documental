import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BuscarAuditoriaDto } from './dto/buscar-auditoria.dto';

export type AccionAuditoria =
  | 'ver'
  | 'descargar'
  | 'editar'
  | 'eliminar'
  | 'eliminar_libro'
  | 'subir_libro'
  | 'reanudar_libro'
  | 'subir_documento_manual'
  | 'dividir_documento'
  | 'login';

export interface RegistroAuditoria {
  id: number;
  accion: string;
  fecha: Date;
  detalle: unknown;
  usuario: { id: number; email: string; rol: string } | null;
  documento: { id: number; consecutivo: string } | null;
}

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  // usuarioId=null significa que la accion la hizo el propio pipeline OCR,
  // no una persona (ver PLAN_API.md seccion 4.5).
  async registrar(params: {
    usuarioId: number | null;
    accion: AccionAuditoria;
    documentoId?: number | null;
    detalle?: Record<string, unknown> | null;
  }): Promise<void> {
    await this.prisma.auditoria.create({
      data: {
        usuarioId: params.usuarioId,
        accion: params.accion,
        documentoId: params.documentoId ?? null,
        detalle: params.detalle ? JSON.stringify(params.detalle) : null,
      },
    });
  }

  // GET /auditoria (solo admin, ver auditoria.controller.ts): la tabla
  // auditoria no tiene relaciones declaradas en el schema porque
  // usuario/documento pueden no existir mas (usuario borrado, documento
  // eliminado) - se resuelven aparte con un segundo query por lote en vez
  // de un include, para no romper el registro historico si el id ya no
  // existe.
  async buscar(filtros: BuscarAuditoriaDto): Promise<{
    total: number;
    page: number;
    page_size: number;
    resultados: RegistroAuditoria[];
  }> {
    const where: Prisma.AuditoriaWhereInput = {};
    if (filtros.accion) where.accion = filtros.accion;
    if (filtros.usuario_id !== undefined) where.usuarioId = filtros.usuario_id;
    if (filtros.documento_id !== undefined) where.documentoId = filtros.documento_id;
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

    const usuarioIds = [...new Set(filas.map((f) => f.usuarioId).filter((id): id is number => id !== null))];
    const documentoIds = [...new Set(filas.map((f) => f.documentoId).filter((id): id is number => id !== null))];

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
      detalle: f.detalle ? (JSON.parse(f.detalle) as unknown) : null,
      usuario: f.usuarioId !== null ? (usuariosPorId.get(f.usuarioId) ?? null) : null,
      documento: f.documentoId !== null ? (documentosPorId.get(f.documentoId) ?? null) : null,
    }));

    return { total, page, page_size: pageSize, resultados };
  }
}
