import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { SistemaService } from './sistema.service';

@ApiTags('sistema')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/sistema')
export class SistemaController {
  constructor(private readonly sistema: SistemaService) {}

  @Get('almacenamiento')
  @Roles('admin')
  almacenamiento() {
    return this.sistema.almacenamiento();
  }
}
