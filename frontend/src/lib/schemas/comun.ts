import { z } from 'zod';

export const REGEX_FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const esquemaFechaOpcional = z
	.string()
	.regex(REGEX_FECHA, 'Formato de fecha invalido (AAAA-MM-DD)')
	.optional()
	.or(z.literal(''));
