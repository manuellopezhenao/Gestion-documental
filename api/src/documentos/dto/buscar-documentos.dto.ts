import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, Min } from 'class-validator';

const aBooleano = ({ value }: { value: unknown }): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  return value === true || value === 'true' || value === '1';
};

export class BuscarDocumentosDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consecutivo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  consecutivo_desde?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  consecutivo_hasta?: number;

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
  fecha_desde?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD' })
  @IsOptional()
  @IsString()
  fecha_hasta?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM' })
  @IsOptional()
  @IsString()
  periodo?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  libro_id?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  revisar?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  motivo_revisar?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @Transform(aBooleano)
  @IsBoolean()
  incluir_eliminados?: boolean;

  @ApiPropertyOptional({ description: 'Busqueda libre: consecutivo, cedula o nombre' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number = 50;

  @ApiPropertyOptional({ enum: ['consecutivo', 'fecha', 'procesado_en'] })
  @IsOptional()
  @IsIn(['consecutivo', 'fecha', 'procesado_en'])
  orden_por?: 'consecutivo' | 'fecha' | 'procesado_en' = 'procesado_en';

  @ApiPropertyOptional({ enum: ['asc', 'desc'] })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  orden?: 'asc' | 'desc' = 'desc';
}
