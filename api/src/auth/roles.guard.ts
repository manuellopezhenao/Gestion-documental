import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';
import { Rol, UsuarioAutenticado } from './types';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesPermitidos = this.reflector.getAllAndOverride<Rol[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!rolesPermitidos || rolesPermitidos.length === 0) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: UsuarioAutenticado }>();
    const usuario = request.user;
    return !!usuario && rolesPermitidos.includes(usuario.rol);
  }
}
