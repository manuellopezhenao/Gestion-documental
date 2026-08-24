import { apiFetch } from './apiFetch';
import type { ResultadoBusqueda, RegistroAuditoria } from '$lib/types/modelos';

export interface FiltrosAuditoria {
	accion?: string;
	usuario_id?: number;
	documento_id?: number;
	fecha_desde?: string;
	fecha_hasta?: string;
	page?: number;
	page_size?: number;
}

export function buscarAuditoria(filtros: FiltrosAuditoria): Promise<ResultadoBusqueda<RegistroAuditoria>> {
	return apiFetch('/api/v1/auditoria', { query: filtros as Record<string, string | number | boolean | undefined> });
}
