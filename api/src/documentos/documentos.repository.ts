import { Injectable } from '@nestjs/common';
import { Documento, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BuscarDocumentosDto } from './dto/buscar-documentos.dto';

const INCLUDE_RELACIONES = { persona: true, libro: true } satisfies Prisma.DocumentoInclude;

export type DocumentoConRelaciones = Prisma.DocumentoGetPayload<{ include: typeof INCLUDE_RELACIONES }>;

@Injectable()
export class DocumentosRepository {
  constructor(private readonly prisma: PrismaService) {}

  private construirWhere(filtros: BuscarDocumentosDto): Prisma.DocumentoWhereInput {
    const where: Prisma.DocumentoWhereInput = {};

    if (!filtros.incluir_eliminados) {
      where.eliminadoEn = null;
    }
    if (filtros.consecutivo) {
      where.consecutivo = filtros.consecutivo;
    }
    if (filtros.consecutivo_desde !== undefined || filtros.consecutivo_hasta !== undefined) {
      where.consecutivoNum = {
        ...(filtros.consecutivo_desde !== undefined ? { gte: filtros.consecutivo_desde } : {}),
        ...(filtros.consecutivo_hasta !== undefined ? { lte: filtros.consecutivo_hasta } : {}),
      };
    }
    if (filtros.libro_id !== undefined) {
      where.libroId = filtros.libro_id;
    }
    if (filtros.revisar !== undefined) {
      where.revisar = filtros.revisar;
    }
    if (filtros.motivo_revisar) {
      where.motivoRevisar = filtros.motivo_revisar;
    }
    if (filtros.fecha_desde || filtros.fecha_hasta) {
      where.fecha = {
        ...(filtros.fecha_desde ? { gte: new Date(filtros.fecha_desde) } : {}),
        ...(filtros.fecha_hasta ? { lte: new Date(filtros.fecha_hasta) } : {}),
      };
    }
    if (filtros.periodo) {
      const [inicio, fin] = rangoDePeriodo(filtros.periodo);
      where.OR = [
        { fecha: { gte: inicio, lt: fin } },
        { AND: [{ fecha: null }, { periodoLibro: { gte: inicio, lt: fin } }] },
      ];
    }
    if (filtros.cedula || filtros.nombre) {
      where.persona = {
        ...(filtros.cedula ? { cedula: filtros.cedula } : {}),
        ...(filtros.nombre ? { nombre: { contains: filtros.nombre } } : {}),
      };
    }
    if (filtros.q) {
      const q = filtros.q;
      where.AND = [
        ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
        {
          OR: [
            { consecutivo: { contains: q } },
            { persona: { cedula: { contains: q } } },
            { persona: { nombre: { contains: q } } },
          ],
        },
      ];
    }
    return where;
  }

  private ordenarPor(filtros: BuscarDocumentosDto): Prisma.DocumentoOrderByWithRelationInput {
    const direccion = filtros.orden ?? 'desc';
    switch (filtros.orden_por) {
      case 'consecutivo':
        return { consecutivoNum: direccion };
      case 'fecha':
        return { fecha: direccion };
      default:
        return { procesadoEn: direccion };
    }
  }

  async buscar(filtros: BuscarDocumentosDto): Promise<[DocumentoConRelaciones[], number]> {
    const where = this.construirWhere(filtros);
    const page = filtros.page ?? 1;
    const pageSize = filtros.page_size ?? 50;

    return this.prisma.$transaction([
      this.prisma.documento.findMany({
        where,
        include: INCLUDE_RELACIONES,
        orderBy: this.ordenarPor(filtros),
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.documento.count({ where }),
    ]);
  }

  porId(id: number) {
    return this.prisma.documento.findFirst({
      where: { id },
      include: INCLUDE_RELACIONES,
    });
  }

  crear(data: Prisma.DocumentoUncheckedCreateInput): Promise<Documento> {
    return this.prisma.documento.create({ data });
  }

  actualizar(id: number, data: Prisma.DocumentoUncheckedUpdateInput): Promise<Documento> {
    return this.prisma.documento.update({ where: { id }, data });
  }

  softDelete(id: number): Promise<Documento> {
    return this.prisma.documento.update({ where: { id }, data: { eliminadoEn: new Date() } });
  }

  async existeConsecutivo(consecutivoNum: number, excluirId?: number): Promise<boolean> {
    const doc = await this.prisma.documento.findFirst({
      where: { consecutivoNum, eliminadoEn: null, ...(excluirId ? { id: { not: excluirId } } : {}) },
      select: { id: true },
    });
    return doc !== null;
  }

  async listarConsecutivos(libroId?: number) {
    return this.prisma.documento.findMany({
      where: { eliminadoEn: null, ...(libroId ? { libroId } : {}) },
      select: { id: true, consecutivo: true, consecutivoNum: true, revisar: true, motivoRevisar: true },
      orderBy: { consecutivoNum: 'asc' },
    });
  }
}

function rangoDePeriodo(periodo: string): [Date, Date] {
  const [anio, mes] = periodo.split('-').map(Number);
  const inicio = new Date(Date.UTC(anio, mes - 1, 1));
  const fin = new Date(Date.UTC(mes === 12 ? anio + 1 : anio, mes === 12 ? 0 : mes, 1));
  return [inicio, fin];
}
