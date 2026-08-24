import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AuditoriaService } from './auditoria.service';
import { BuscarAuditoriaDto } from './dto/buscar-auditoria.dto';

@ApiTags('auditoria')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/auditoria')
export class AuditoriaController {
  constructor(private readonly auditoria: AuditoriaService) {}

  @Get()
  @Roles('admin')
  buscar(@Query() filtros: BuscarAuditoriaDto) {
    return this.auditoria.buscar(filtros);
  }
}
