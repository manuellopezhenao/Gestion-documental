import { formatoMotivo, descripcionMotivo } from './motivoRevisar';

export interface EstadoBadge {
	tono: 'verde' | 'amarillo' | 'rojo' | 'gris' | 'azul';
	texto: string;
	titulo?: string;
}

export function estadoDocumento(revisar: boolean, motivoRevisar: string | null, eliminadoEn?: string | null): EstadoBadge {
	if (eliminadoEn) return { tono: 'rojo', texto: 'eliminado', titulo: `Eliminado el ${formatoFecha(eliminadoEn)}` };
	if (!revisar) return { tono: 'verde', texto: 'ok' };
	return { tono: 'amarillo', texto: formatoMotivo(motivoRevisar), titulo: descripcionMotivo(motivoRevisar) };
}

export function formatoFecha(fecha: string | null): string {
	if (!fecha) return '— sin dato —';
	return fecha.slice(0, 10);
}

export function formatoTexto(valor: string | null | undefined): string {
	return valor && valor.length > 0 ? valor : '— sin dato —';
}
