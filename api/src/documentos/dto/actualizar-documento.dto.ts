import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// PATCH /documentos/:id - unica forma de corregir estos datos a mano
// (PLAN_API.md seccion 10). Cada campo enviado se audita antes/despues.
export class ActualizarDocumentoDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  cedula?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  nombre?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  fecha?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consecutivo?: string;
}
