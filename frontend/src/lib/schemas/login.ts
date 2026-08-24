import { z } from 'zod';

export const esquemaLogin = z.object({
	email: z.string().email('Correo invalido'),
	password: z.string().min(8, 'Minimo 8 caracteres')
});
