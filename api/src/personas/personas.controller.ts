import { Controller, Get, Param, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PersonasService } from './personas.service';

@ApiTags('personas')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/personas')
export class PersonasController {
  constructor(private readonly personas: PersonasService) {}

  @Get()
  buscar(@Query('q') q?: string, @Query('page') page = 1, @Query('page_size') pageSize = 50) {
    return this.personas.buscar(q, Number(page), Number(pageSize));
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.personas.detalle(id);
  }

  @Get(':id/documentos')
  documentos(@Param('id', ParseIntPipe) id: number) {
    return this.personas.documentosDe(id);
  }
}
