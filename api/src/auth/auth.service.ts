import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { JwtPayload, Rol } from './types';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly auditoria: AuditoriaService,
  ) {}

  async login(email: string, password: string): Promise<{ accessToken: string }> {
    const usuario = await this.prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.activo) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const passwordOk = await bcrypt.compare(password, usuario.passwordHash);
    if (!passwordOk) {
      throw new UnauthorizedException('Credenciales invalidas');
    }

    const payload: JwtPayload = { sub: usuario.id, email: usuario.email, rol: usuario.rol as Rol };
    const accessToken = await this.jwt.signAsync(payload);

    await this.auditoria.registrar({ usuarioId: usuario.id, accion: 'login' });

    return { accessToken };
  }
}
