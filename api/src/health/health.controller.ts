import { Controller, Get, Inject } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';
import { Storage, STORAGE_TOKEN } from '../storage/storage.interface';

@ApiTags('infraestructura')
@Controller('api/v1/health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(STORAGE_TOKEN) private readonly storage: Storage,
  ) {}

  @Get()
  async estado() {
    const [dbOk, storageOk] = await Promise.all([this.chequearDb(), this.chequearStorage()]);
    const ok = dbOk && storageOk;
    return {
      estado: ok ? 'ok' : 'degradado',
      base_datos: dbOk ? 'ok' : 'error',
      storage: storageOk ? 'ok' : 'error',
    };
  }

  private async chequearDb(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  private async chequearStorage(): Promise<boolean> {
    try {
      await this.storage.existe('.');
      return true;
    } catch {
      return false;
    }
  }
}
