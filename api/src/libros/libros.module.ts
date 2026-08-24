import { Module } from '@nestjs/common';
import { LibrosController } from './libros.controller';
import { LibrosService } from './libros.service';
import { LibrosRepository } from './libros.repository';
import { ProcesarLibroJob } from './jobs/procesar-libro.job';
import { PersonasModule } from '../personas/personas.module';

@Module({
  imports: [PersonasModule],
  controllers: [LibrosController],
  providers: [LibrosService, LibrosRepository, ProcesarLibroJob],
  exports: [LibrosService],
})
export class LibrosModule {}
