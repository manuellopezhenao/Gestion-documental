import { apiFetch } from './apiFetch';
import type { InfoAlmacenamiento } from '$lib/types/modelos';

export function obtenerAlmacenamiento(): Promise<InfoAlmacenamiento> {
	return apiFetch('/api/v1/sistema/almacenamiento');
}
