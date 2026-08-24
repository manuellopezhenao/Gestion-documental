export type Rol = 'admin' | 'editor' | 'lector';

export interface JwtPayload {
  sub: number; // usuario.id
  email: string;
  rol: Rol;
}

export interface UsuarioAutenticado {
  id: number;
  email: string;
  rol: Rol;
}
