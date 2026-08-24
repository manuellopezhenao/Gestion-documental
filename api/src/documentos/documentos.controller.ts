import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { UsuarioAutenticado } from '../auth/types';
import { DocumentosService } from './documentos.service';
import { BuscarDocumentosDto } from './dto/buscar-documentos.dto';
import { CrearDocumentoManualDto } from './dto/crear-documento-manual.dto';
import { ActualizarDocumentoDto } from './dto/actualizar-documento.dto';
import { DividirDocumentoDto } from './dto/dividir-documento.dto';

@ApiTags('documentos')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/documentos')
export class DocumentosController {
  constructor(private readonly documentos: DocumentosService) {}

  @Get()
  buscar(@Query() filtros: BuscarDocumentosDto) {
    return this.documentos.buscar(filtros);
  }

  // Declarado antes de ":id" para que "consecutivos" no se interprete como
  // un id de documento.
  @Get('consecutivos')
  listarConsecutivos(@Query('libro_id') libroId?: string) {
    return this.documentos.listarConsecutivos(libroId ? Number(libroId) : undefined);
  }

  @Get('consecutivos/huecos')
  huecos(@Query('libro_id') libroId?: string) {
    return this.documentos.huecos(libroId ? Number(libroId) : undefined);
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.documentos.detalle(id);
  }

  @Get(':id/archivo')
  async archivo(
    @Param('id', ParseIntPipe) id: number,
    @Query('modo') modo: 'inline' | 'attachment' = 'attachment',
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res() res: Response,
  ) {
    const { buffer, documento } = await this.documentos.obtenerArchivo(id, usuario.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${modo === 'inline' ? 'inline' : 'attachment'}; filename="${documento.consecutivo}.pdf"`,
    );
    res.send(buffer);
  }

  @Post()
  @Roles('editor', 'admin')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  crearManual(
    @Body() dto: CrearDocumentoManualDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    if (!archivo) {
      throw new BadRequestException('Falta el archivo PDF (campo "archivo")');
    }
    return this.documentos.crearManual(dto, archivo.buffer, usuario.id);
  }

  @Patch(':id')
  @Roles('editor', 'admin')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  actualizar(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizarDocumentoDto,
    @UploadedFile() archivo: Express.Multer.File | undefined,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.documentos.actualizar(id, dto, usuario.id, archivo?.buffer);
  }

  @Delete(':id')
  @Roles('admin')
  eliminar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.documentos.eliminar(id, usuario.id);
  }

  @Post(':id/dividir')
  @Roles('editor', 'admin')
  dividir(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DividirDocumentoDto,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ) {
    return this.documentos.dividir(id, dto, usuario.id);
  }

  @Get(':id/versiones')
  @Roles('editor', 'admin')
  versiones(@Param('id', ParseIntPipe) id: number) {
    return this.documentos.versiones(id);
  }

  @Get(':id/versiones/:indice/archivo')
  @Roles('editor', 'admin')
  async archivoVersion(
    @Param('id', ParseIntPipe) id: number,
    @Param('indice', ParseIntPipe) indice: number,
    @Query('modo') modo: 'inline' | 'attachment' = 'attachment',
    @UsuarioActual() usuario: UsuarioAutenticado,
    @Res() res: Response,
  ) {
    const { buffer, documento, version } = await this.documentos.archivoVersion(id, indice, usuario.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `${modo === 'inline' ? 'inline' : 'attachment'}; filename="${documento.consecutivo}_v${version.indice}.pdf"`,
    );
    res.send(buffer);
  }
}
