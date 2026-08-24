import { Inject, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { Storage, STORAGE_TOKEN } from '../storage/storage.interface';

export interface InfoAlmacenamiento {
  base_datos: {
    proveedor: string;
    ruta: string | null;
    tamano_bytes: number | null;
  };
  storage: {
    backend: string;
    ruta: string;
    archivos: number;
    tamano_bytes: number;
  };
}

@Injectable()
export class SistemaService {
  constructor(@Inject(STORAGE_TOKEN) private readonly storage: Storage) {}

  // GET /sistema/almacenamiento (solo admin): responde donde vive
  // realmente cada cosa en disco, para poder respaldar/migrar sin
  // adivinar (ver conversacion con el usuario sobre entregarle la app a
  // un tester y despues pedirle los datos de vuelta).
  async almacenamiento(): Promise<InfoAlmacenamiento> {
    const [baseDatos, stats] = await Promise.all([this.infoBaseDatos(), this.storage.estadisticas()]);

    return {
      base_datos: baseDatos,
      storage: {
        backend: process.env.STORAGE_BACKEND ?? 'filesystem',
        ruta: this.storage.raiz(),
        archivos: stats.archivos,
        tamano_bytes: stats.bytes,
      },
    };
  }

  // No expone el connection string completo si no es sqlite -- podria
  // traer credenciales embebidas (mysql://usuario:password@host/...).
  private async infoBaseDatos(): Promise<InfoAlmacenamiento['base_datos']> {
    const url = process.env.DATABASE_URL ?? '';
    if (url.startsWith('file:')) {
      const rutaAbsoluta = path.resolve(process.cwd(), 'prisma', url.slice('file:'.length));
      const tamano = await fs
        .stat(rutaAbsoluta)
        .then((s) => s.size)
        .catch(() => null);
      return { proveedor: 'sqlite', ruta: rutaAbsoluta, tamano_bytes: tamano };
    }
    const proveedor = url.split(':')[0] || 'desconocido';
    return { proveedor, ruta: null, tamano_bytes: null };
  }
}
