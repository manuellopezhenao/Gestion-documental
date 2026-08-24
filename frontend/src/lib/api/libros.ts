import { apiFetch } from './apiFetch';
import type { Libro, DocumentoConPersona } from '$lib/types/modelos';

export function listarLibros(): Promise<Libro[]> {
	return apiFetch('/api/v1/libros');
}

export function detalleLibro(id: number): Promise<Libro> {
	return apiFetch(`/api/v1/libros/${id}`);
}

export function documentosDeLibro(id: number): Promise<DocumentoConPersona[]> {
	return apiFetch(`/api/v1/libros/${id}/documentos`);
}

export function estadoLibro(id: number): Promise<Libro> {
	return apiFetch(`/api/v1/libros/${id}/estado`);
}

export function subirLibro(archivo: File): Promise<Libro> {
	const form = new FormData();
	form.set('archivo', archivo);
	return apiFetch('/api/v1/libros', { method: 'POST', body: form });
}

export function reanudarLibro(id: number): Promise<Libro> {
	return apiFetch(`/api/v1/libros/${id}/reanudar`, { method: 'POST' });
}

export function eliminarLibro(id: number): Promise<{ ok: true; documentosEliminados: number }> {
	return apiFetch(`/api/v1/libros/${id}`, { method: 'DELETE' });
}
