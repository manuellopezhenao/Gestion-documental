import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { StorageModule } from './storage/storage.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuthModule } from './auth/auth.module';
import { DocumentosModule } from './documentos/documentos.module';
import { PersonasModule } from './personas/personas.module';
import { LibrosModule } from './libros/libros.module';
import { ReportesModule } from './reportes/reportes.module';
import { HealthModule } from './health/health.module';
import { SistemaModule } from './sistema/sistema.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    PrismaModule,
    StorageModule,
    AuditoriaModule,
    AuthModule,
    PersonasModule,
    DocumentosModule,
    LibrosModule,
    ReportesModule,
    HealthModule,
    SistemaModule,
  ],
})
export class AppModule {}
