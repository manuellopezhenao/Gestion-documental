import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import type { Rol } from '$lib/types/modelos';

const CLAVE_TOKEN = 'gd_token';

interface JwtPayload {
	sub: number;
	email: string;
	rol: Rol;
	exp?: number;
}

function decodificarToken(valorToken: string): JwtPayload | null {
	try {
		const payload = valorToken.split('.')[1];
		const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
		return JSON.parse(decodeURIComponent(escape(json))) as JwtPayload;
	} catch {
		return null;
	}
}

function tokenInicial(): string | null {
	return browser ? localStorage.getItem(CLAVE_TOKEN) : null;
}

export const token = writable<string | null>(tokenInicial());

export const usuario = derived(token, (t) => (t ? decodificarToken(t) : null));

export const rol = derived(usuario, (u) => u?.rol ?? null);

export function iniciarSesion(nuevoToken: string): void {
	if (browser) localStorage.setItem(CLAVE_TOKEN, nuevoToken);
	token.set(nuevoToken);
}

export function cerrarSesion(): void {
	if (browser) localStorage.removeItem(CLAVE_TOKEN);
	token.set(null);
}

const ORDEN_ROL: Record<Rol, number> = { lector: 0, editor: 1, admin: 2 };

export function tieneRol(rolActual: Rol | null, minimo: Rol): boolean {
	if (!rolActual) return false;
	return ORDEN_ROL[rolActual] >= ORDEN_ROL[minimo];
}
