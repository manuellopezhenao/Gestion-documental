import { get } from 'svelte/store';
import { goto } from '$app/navigation';
import { PUBLIC_API_URL } from '$env/static/public';
import { token, cerrarSesion } from '$lib/stores/sesion';
import type { ErrorApi } from '$lib/types/modelos';

export class ApiError extends Error {
	constructor(
		public readonly status: number,
		public readonly cuerpo: ErrorApi
	) {
		super(cuerpo.mensaje);
	}
}

type ValorQuery = string | number | boolean | undefined | null;

interface OpcionesApiFetch extends RequestInit {
	query?: Record<string, ValorQuery>;
}

function construirUrl(ruta: string, query?: Record<string, ValorQuery>): string {
	const base = PUBLIC_API_URL || (typeof window !== 'undefined' ? window.location.origin : '');
	const url = new URL(ruta, base);
	if (query) {
		for (const [clave, valor] of Object.entries(query)) {
			if (valor !== undefined && valor !== null && valor !== '') {
				url.searchParams.set(clave, String(valor));
			}
		}
	}
	return url.toString();
}

const ERROR_DESCONOCIDO: ErrorApi = {
	error: 'error_interno',
	mensaje: 'Ocurrio un error inesperado',
	detalle: null
};

async function leerError(respuesta: Response): Promise<ErrorApi> {
	const cuerpo = (await respuesta.json().catch(() => null)) as ErrorApi | null;
	return cuerpo ?? { ...ERROR_DESCONOCIDO, mensaje: respuesta.statusText || ERROR_DESCONOCIDO.mensaje };
}

async function ejecutar(ruta: string, opciones: OpcionesApiFetch): Promise<Response> {
	const { query, headers, ...resto } = opciones;
	const tokenActual = get(token);

	const respuesta = await fetch(construirUrl(ruta, query), {
		...resto,
		headers: {
			...(tokenActual ? { Authorization: `Bearer ${tokenActual}` } : {}),
			...headers
		}
	});

	if (respuesta.status === 401) {
		cerrarSesion();
		void goto('/login');
		throw new ApiError(401, await leerError(respuesta));
	}

	if (!respuesta.ok) {
		throw new ApiError(respuesta.status, await leerError(respuesta));
	}

	return respuesta;
}

export async function apiFetch<T>(ruta: string, opciones: OpcionesApiFetch = {}): Promise<T> {
	const respuesta = await ejecutar(ruta, opciones);
	if (respuesta.status === 204) return undefined as T;
	const contentType = respuesta.headers.get('content-type') ?? '';
	if (!contentType.includes('application/json')) return undefined as T;
	return (await respuesta.json()) as T;
}

export async function apiFetchBlob(ruta: string, opciones: OpcionesApiFetch = {}): Promise<Blob> {
	const respuesta = await ejecutar(ruta, opciones);
	return respuesta.blob();
}
