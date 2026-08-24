import { Injectable, NotFoundException } from '@nestjs/common';
import { Persona } from '@prisma/client';
import { PersonasRepository } from './personas.repository';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PersonasService {
  constructor(
    private readonly repo: PersonasRepository,
    private readonly prisma: PrismaService,
  ) {}

  // Traduccion directa de get_or_create_persona en split_consecutivos.py:
  // busca por cedula para no duplicar a alguien que ya aparecio antes; si
  // ya existe pero no tenia nombre, lo completa - NUNCA sobreescribe un
  // nombre bueno con uno peor (principio 3 de PLAN_API.md).
  async getOrCreatePersona(cedula: string | null, nombre: string | null): Promise<Persona | null> {
    if (!cedula) return null;

    const existente = await this.repo.porCedula(cedula);
    if (existente) {
      if (nombre && !existente.nombre) {
        return this.repo.actualizarNombre(existente.id, nombre);
      }
      return existente;
    }
    return this.repo.crear(cedula, nombre);
  }

  async buscar(q: string | undefined, page: number, pageSize: number) {
    const [resultados, total] = await this.repo.listar({ q, page, pageSize });
    return { total, page, page_size: pageSize, resultados };
  }

  async detalle(id: number): Promise<Persona> {
    const persona = await this.repo.porId(id);
    if (!persona) throw new NotFoundException(`No existe la persona con id ${id}`);
    return persona;
  }

  async documentosDe(id: number) {
    await this.detalle(id);
    return this.prisma.documento.findMany({
      where: { personaId: id, eliminadoEn: null },
      orderBy: { procesadoEn: 'desc' },
      include: { libro: true },
    });
  }
}
