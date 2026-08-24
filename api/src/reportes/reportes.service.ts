import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [totalDocumentos, pendientesRevisar, personasSinCedula, librosConError, porMes] = await Promise.all([
      this.prisma.documento.count({ where: { eliminadoEn: null } }),
      this.prisma.documento.count({ where: { eliminadoEn: null, revisar: true } }),
      this.prisma.persona.count({ where: { cedula: null } }),
      this.prisma.libro.count({ where: { estado: 'error' } }),
      // strftime() es especifico de sqlite; al migrar a MySQL (PLAN_API.md
      // seccion 5) cambiar por DATE_FORMAT(COALESCE(fecha, periodo_libro), '%Y-%m').
      // Prisma guarda los DateTime de sqlite como epoch en milisegundos
      // (entero), pero strftime() solo reconoce epoch en SEGUNDOS con el
      // modificador 'unixepoch' (o texto ISO8601) - de ahi el /1000.
      this.prisma.$queryRaw<{ mes: string; total: bigint }[]>`
        SELECT strftime('%Y-%m', COALESCE(fecha, periodo_libro) / 1000, 'unixepoch') AS mes, COUNT(*) AS total
        FROM documentos
        WHERE eliminado_en IS NULL
        GROUP BY mes
        ORDER BY mes DESC
        LIMIT 12
      `,
    ]);

    return {
      total_documentos: totalDocumentos,
      pendientes_revisar: pendientesRevisar,
      personas_sin_cedula: personasSinCedula,
      libros_con_errores: librosConError,
      // sqlite devuelve COUNT(*) como BigInt via $queryRaw; JSON.stringify no
      // sabe serializar BigInt, asi que se convierte antes de responder.
      documentos_por_mes: porMes.map((fila) => ({ mes: fila.mes, total: Number(fila.total) })),
    };
  }
}
