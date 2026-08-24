import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt, IsOptional, IsString, Min, ValidateNested } from 'class-validator';

export class ParteDivisionDto {
  @ApiProperty({ description: 'Primera pagina del PDF original que le corresponde a esta parte (1-indexado)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina_inicio!: number;

  @ApiProperty({ description: 'Ultima pagina del PDF original que le corresponde a esta parte (1-indexado, inclusive)' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina_fin!: number;

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

// POST /documentos/:id/dividir: el documento original tenia varios
// consecutivos mezclados en un solo PDF (error de OCR al no detectar el
// corte entre facturas) - se parte su PDF en 2 o mas, cada uno con sus
// propios datos.
export class DividirDocumentoDto {
  @ApiProperty({ type: [ParteDivisionDto] })
  @ValidateNested({ each: true })
  @Type(() => ParteDivisionDto)
  @ArrayMinSize(2, { message: 'Se necesitan al menos 2 partes para dividir un documento' })
  partes!: ParteDivisionDto[];
}
