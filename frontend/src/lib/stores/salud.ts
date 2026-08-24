import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { obtenerSalud } from '$lib/api/reportes';
import type { HealthEstado } from '$lib/types/modelos';

export const salud = writable<HealthEstado | null>(null);

let intervalo: ReturnType<typeof setInterval> | undefined;

async function verificar(): Promise<void> {
	try {
		salud.set(await obtenerSalud());
	} catch {
		salud.set({ estado: 'degradado', base_datos: 'error', storage: 'error' });
	}
}

export function iniciarMonitoreoSalud(): void {
	if (!browser || intervalo) return;
	void verificar();
	intervalo = setInterval(() => void verificar(), 30000);
}
