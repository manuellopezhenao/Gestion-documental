import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { promises as fs, type Dirent } from 'fs';
import * as path from 'path';
import { Storage } from './storage.interface';
import { AppConfig } from '../config/configuration';

@Injectable()
export class FilesystemStorage implements Storage {
  private readonly root: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    const appConfig = config.get<AppConfig>('app')!;
    this.root = path.resolve(process.cwd(), appConfig.storagePath);
  }

  // Nunca confia en que rutaRelativa venga limpia (aunque hoy siempre la
  // arma el propio repositorio, no el cliente) - resuelve y verifica que el
  // resultado siga dentro de `root` para blindar contra path traversal.
  private resolverDentroDeRoot(rutaRelativa: string): string {
    const destino = path.resolve(this.root, rutaRelativa);
    if (!destino.startsWith(this.root + path.sep) && destino !== this.root) {
      throw new Error(`Ruta fuera del storage permitido: ${rutaRelativa}`);
    }
    return destino;
  }

  async guardar(rutaRelativa: string, datos: Buffer): Promise<void> {
    const destino = this.resolverDentroDeRoot(rutaRelativa);
    await fs.mkdir(path.dirname(destino), { recursive: true });
    await fs.writeFile(destino, datos);
  }

  async leer(rutaRelativa: string): Promise<Buffer> {
    return fs.readFile(this.resolverDentroDeRoot(rutaRelativa));
  }

  async existe(rutaRelativa: string): Promise<boolean> {
    try {
      await fs.access(this.resolverDentroDeRoot(rutaRelativa));
      return true;
    } catch {
      return false;
    }
  }

  async eliminar(rutaRelativa: string): Promise<void> {
    await fs.unlink(this.resolverDentroDeRoot(rutaRelativa));
  }

  raiz(): string {
    return this.root;
  }

  async estadisticas(): Promise<{ archivos: number; bytes: number }> {
    let archivos = 0;
    let bytes = 0;

    const recorrer = async (dir: string): Promise<void> => {
      let entradas: Dirent[];
      try {
        entradas = await fs.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entrada of entradas) {
        const ruta = path.join(dir, entrada.name);
        if (entrada.isDirectory()) {
          await recorrer(ruta);
        } else if (entrada.isFile()) {
          archivos += 1;
          bytes += (await fs.stat(ruta)).size;
        }
      }
    };

    await recorrer(this.root);
    return { archivos, bytes };
  }
}
