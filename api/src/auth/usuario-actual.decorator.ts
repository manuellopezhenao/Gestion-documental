import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { UsuarioAutenticado } from './types';

export const UsuarioActual = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioAutenticado => {
    const request = ctx.switchToHttp().getRequest<{ user: UsuarioAutenticado }>();
    return request.user;
  },
);
