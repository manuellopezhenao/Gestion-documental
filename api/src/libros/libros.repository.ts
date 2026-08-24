import { Injectable } from '@nestjs/common';
import { Libro, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LibrosRepository {
  constructor(private readonly prisma: PrismaService) {}

  crear(data: Prisma.LibroUncheckedCreateInput): Promise<Libro> {
    return this.prisma.libro.create({ data });
  }

  porId(id: number): Promise<Libro | null> {
    return this.prisma.libro.findUnique({ where: { id } });
  }

  actualizar(id: number, data: Prisma.LibroUncheckedUpdateInput): Promise<Libro> {
    return this.prisma.libro.update({ where: { id }, data });
  }

  listar(): Promise<Libro[]> {
    return this.prisma.libro.findMany({ orderBy: { id: 'desc' } });
  }

  listarPorEstado(estado: string): Promise<Libro[]> {
    return this.prisma.libro.findMany({ where: { estado } });
  }

  documentosDe(libroId: number) {
    return this.prisma.documento.findMany({
      where: { libroId, eliminadoEn: null },
      include: { persona: true },
      orderBy: { consecutivoNum: 'asc' },
    });
  }

  // Incluye tambien los ya soft-deleted: al borrar el libro completo se
  // limpian TODOS sus archivos fisicos, no solo los activos.
  todosLosDocumentosDe(libroId: number) {
    return this.prisma.documento.findMany({ where: { libroId } });
  }

  // Hard delete real (a diferencia del soft delete de un documento suelto):
  // el usuario pidio poder deshacer una carga de prueba/duplicada por
  // completo. Se borran los documentos antes que el libro por la FK
  // (Documento.libroId -> Libro.id).
  async eliminarConDocumentos(libroId: number): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.documento.deleteMany({ where: { libroId } }),
      this.prisma.libro.delete({ where: { id: libroId } }),
    ]);
  }
}
