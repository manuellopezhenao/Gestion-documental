import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { UsuarioActual } from '../auth/usuario-actual.decorator';
import { UsuarioAutenticado } from '../auth/types';
import { LibrosService } from './libros.service';

@ApiTags('libros')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('api/v1/libros')
export class LibrosController {
  constructor(private readonly libros: LibrosService) {}

  @Get()
  listar() {
    return this.libros.listar();
  }

  @Get(':id')
  detalle(@Param('id', ParseIntPipe) id: number) {
    return this.libros.detalle(id);
  }

  @Get(':id/documentos')
  documentos(@Param('id', ParseIntPipe) id: number) {
    return this.libros.documentosDe(id);
  }

  @Get(':id/estado')
  estado(@Param('id', ParseIntPipe) id: number) {
    return this.libros.estado(id);
  }

  @Post()
  @Roles('admin')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('archivo'))
  subir(@UploadedFile() archivo: Express.Multer.File | undefined, @UsuarioActual() usuario: UsuarioAutenticado) {
    if (!archivo) {
      throw new BadRequestException('Falta el archivo PDF (campo "archivo")');
    }
    return this.libros.subirLibro(archivo.originalname, archivo.buffer, usuario.id);
  }

  @Post(':id/reanudar')
  @Roles('admin')
  reanudar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.libros.reanudar(id, usuario.id);
  }

  @Delete(':id')
  @Roles('admin')
  eliminar(@Param('id', ParseIntPipe) id: number, @UsuarioActual() usuario: UsuarioAutenticado) {
    return this.libros.eliminar(id, usuario.id);
  }
}
