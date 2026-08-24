import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// El archivo PDF va aparte (multipart), interceptado con FileInterceptor
// en el controller - este DTO son solo los campos de texto del form.
export class CrearDocumentoManualDto {
  @ApiProperty()
  @IsString()
  consecutivo!: string;

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
}
