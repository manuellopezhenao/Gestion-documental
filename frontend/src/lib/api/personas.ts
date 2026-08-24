import { apiFetch } from './apiFetch';
import type { Persona, DocumentoConLibro, ResultadoBusqueda } from '$lib/types/modelos';

export function buscarPersonas(
	q: string | undefined,
	page = 1,
	pageSize = 50
): Promise<ResultadoBusqueda<Persona>> {
	return apiFetch('/api/v1/personas', { query: { q, page, page_size: pageSize } });
}

export function detallePersona(id: number): Promise<Persona> {
	return apiFetch(`/api/v1/personas/${id}`);
}

export function documentosDePersona(id: number): Promise<DocumentoConLibro[]> {
	return apiFetch(`/api/v1/personas/${id}/documentos`);
}
