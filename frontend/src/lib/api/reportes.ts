import { apiFetch } from './apiFetch';
import type { ReporteResumen, HealthEstado } from '$lib/types/modelos';

export function obtenerResumen(): Promise<ReporteResumen> {
	return apiFetch('/api/v1/reportes/resumen');
}

export function obtenerSalud(): Promise<HealthEstado> {
	return apiFetch('/api/v1/health');
}
