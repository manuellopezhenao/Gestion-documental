import { apiFetch, apiFetchBlob } from './apiFetch';
import type {
	Documento,
	DocumentoConRelaciones,
	ResultadoBusqueda,
	ConsecutivoResumen,
	Huecos,
	VersionArchivo
} from '$lib/types/modelos';

export interface FiltrosDocumentos {
	consecutivo?: string;
	consecutivo_desde?: number;
	consecutivo_hasta?: number;
	cedula?: string;
	nombre?: string;
	fecha_desde?: string;
	fecha_hasta?: string;
	periodo?: string;
	libro_id?: number;
	revisar?: boolean;
	motivo_revisar?: string;
	incluir_eliminados?: boolean;
	q?: string;
	page?: number;
	page_size?: number;
	orden_por?: 'consecutivo' | 'fecha' | 'procesado_en';
	orden?: 'asc' | 'desc';
}

export function buscarDocumentos(
	filtros: FiltrosDocumentos
): Promise<ResultadoBusqueda<DocumentoConRelaciones>> {
	return apiFetch('/api/v1/documentos', { query: filtros as Record<string, string | number | boolean | undefined> });
}

export function detalleDocumento(id: number): Promise<DocumentoConRelaciones> {
	return apiFetch(`/api/v1/documentos/${id}`);
}

export function archivoDocumento(id: number, modo: 'inline' | 'attachment' = 'inline'): Promise<Blob> {
	return apiFetchBlob(`/api/v1/documentos/${id}/archivo`, { query: { modo } });
}

export interface CrearDocumentoManualPayload {
	archivo: File;
	consecutivo: string;
	cedula?: string;
	nombre?: string;
	fecha?: string;
}

export function crearDocumentoManual(payload: CrearDocumentoManualPayload): Promise<Documento> {
	const form = new FormData();
	form.set('archivo', payload.archivo);
	form.set('consecutivo', payload.consecutivo);
	if (payload.cedula) form.set('cedula', payload.cedula);
	if (payload.nombre) form.set('nombre', payload.nombre);
	if (payload.fecha) form.set('fecha', payload.fecha);
	return apiFetch('/api/v1/documentos', { method: 'POST', body: form });
}

export interface ActualizarDocumentoPayload {
	cedula?: string;
	nombre?: string;
	fecha?: string;
	consecutivo?: string;
	archivo?: File;
}

export function actualizarDocumento(id: number, payload: ActualizarDocumentoPayload): Promise<Documento> {
	const { archivo, ...campos } = payload;
	const form = new FormData();
	for (const [clave, valor] of Object.entries(campos)) {
		if (valor !== undefined) form.set(clave, valor);
	}
	if (archivo) form.set('archivo', archivo);
	return apiFetch(`/api/v1/documentos/${id}`, { method: 'PATCH', body: form });
}

export function eliminarDocumento(id: number): Promise<Documento> {
	return apiFetch(`/api/v1/documentos/${id}`, { method: 'DELETE' });
}

export interface ParteDivision {
	pagina_inicio: number;
	pagina_fin: number;
	consecutivo: string;
	cedula?: string;
	nombre?: string;
	fecha?: string;
}

export function dividirDocumento(id: number, partes: ParteDivision[]): Promise<Documento[]> {
	return apiFetch(`/api/v1/documentos/${id}/dividir`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ partes })
	});
}

export function versionesDocumento(id: number): Promise<VersionArchivo[]> {
	return apiFetch(`/api/v1/documentos/${id}/versiones`);
}

export function archivoVersion(id: number, indice: number, modo: 'inline' | 'attachment' = 'inline'): Promise<Blob> {
	return apiFetchBlob(`/api/v1/documentos/${id}/versiones/${indice}/archivo`, { query: { modo } });
}

export function listarConsecutivos(libroId?: number): Promise<ConsecutivoResumen[]> {
	return apiFetch('/api/v1/documentos/consecutivos', { query: { libro_id: libroId } });
}

export function huecosConsecutivos(libroId?: number): Promise<Huecos> {
	return apiFetch('/api/v1/documentos/consecutivos/huecos', { query: { libro_id: libroId } });
}
