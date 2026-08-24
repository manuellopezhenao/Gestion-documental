import { SetMetadata } from '@nestjs/common';
import { Rol } from './types';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: Rol[]): ReturnType<typeof SetMetadata> => SetMetadata(ROLES_KEY, roles);
