import { Injectable } from '@nestjs/common';
import { Persona } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonasRepository {
  constructor(private readonly prisma: PrismaService) {}

  porCedula(cedula: string): Promise<Persona | null> {
    return this.prisma.persona.findUnique({ where: { cedula } });
  }

  porId(id: number): Promise<Persona | null> {
    return this.prisma.persona.findUnique({ where: { id } });
  }

  crear(cedula: string | null, nombre: string | null): Promise<Persona> {
    return this.prisma.persona.create({ data: { cedula, nombre } });
  }

  actualizarNombre(id: number, nombre: string): Promise<Persona> {
    return this.prisma.persona.update({ where: { id }, data: { nombre } });
  }

  listar(params: { q?: string; page: number; pageSize: number }): Promise<[Persona[], number]> {
    const where = params.q
      ? {
          OR: [
            { cedula: { contains: params.q } },
            { nombre: { contains: params.q } },
          ],
        }
      : {};
    return this.prisma.$transaction([
      this.prisma.persona.findMany({
        where,
        skip: (params.page - 1) * params.pageSize,
        take: params.pageSize,
        orderBy: { id: 'desc' },
      }),
      this.prisma.persona.count({ where }),
    ]);
  }
}
