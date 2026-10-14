import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportesService {
  constructor(private readonly prisma: PrismaService) {}

  async resumen() {
    const [totalDocumentos, pendientesRevisar, personasSinCedula, librosConError, fechas] = await Promise.all([
      this.prisma.documento.count({ where: { eliminadoEn: null } }),
      this.prisma.documento.count({ where: { eliminadoEn: null, revisar: true } }),
      this.prisma.persona.count({ where: { cedula: null } }),
      this.prisma.libro.count({ where: { estado: 'error' } }),
      // Agrupar por mes se hace en JS y no con SQL crudo: las funciones de
      // fecha cambian en cada motor (strftime en sqlite, FORMAT en SQL
      // Server, DATE_FORMAT en MySQL) y asi este reporte no ata la API a
      // ninguno. Solo se traen las dos columnas de fecha.
      this.prisma.documento.findMany({
        where: { eliminadoEn: null, OR: [{ fecha: { not: null } }, { periodoLibro: { not: null } }] },
        select: { fecha: true, periodoLibro: true },
      }),
    ]);

    return {
      total_documentos: totalDocumentos,
      pendientes_revisar: pendientesRevisar,
      personas_sin_cedula: personasSinCedula,
      libros_con_errores: librosConError,
      documentos_por_mes: this.contarPorMes(fechas),
    };
  }

  private contarPorMes(filas: { fecha: Date | null; periodoLibro: Date | null }[]): { mes: string; total: number }[] {
    const conteo = new Map<string, number>();
    for (const { fecha, periodoLibro } of filas) {
      const base = fecha ?? periodoLibro;
      if (!base) continue;
      const mes = `${base.getUTCFullYear()}-${String(base.getUTCMonth() + 1).padStart(2, '0')}`;
      conteo.set(mes, (conteo.get(mes) ?? 0) + 1);
    }
    return [...conteo.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 12)
      .map(([mes, total]) => ({ mes, total }));
  }
}
