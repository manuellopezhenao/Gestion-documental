import { z } from 'zod';
import { esquemaFechaOpcional } from './comun';

export const esquemaDocumentoManual = z.object({
	consecutivo: z.string().trim().min(1, 'El consecutivo es obligatorio'),
	cedula: z.string().trim().optional().or(z.literal('')),
	nombre: z.string().trim().optional().or(z.literal('')),
	fecha: esquemaFechaOpcional
});

export const esquemaDocumentoEditar = z.object({
	consecutivo: z.string().trim().optional().or(z.literal('')),
	cedula: z.string().trim().optional().or(z.literal('')),
	nombre: z.string().trim().optional().or(z.literal('')),
	fecha: esquemaFechaOpcional
});
