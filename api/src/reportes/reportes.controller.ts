import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReportesService } from './reportes.service';

@ApiTags('reportes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/reportes')
export class ReportesController {
  constructor(private readonly reportes: ReportesService) {}

  @Get('resumen')
  resumen() {
    return this.reportes.resumen();
  }
}
