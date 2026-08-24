export const ETIQUETA_MOTIVO: Record<string, string> = {
	sin_cedula: 'Sin cedula',
	sin_fecha: 'Sin fecha',
	consecutivo_repetido: 'Consecutivo repetido',
	consecutivo_fuera_de_tendencia: 'Consecutivo fuera de tendencia',
	consecutivo_no_numerico: 'Consecutivo no numerico',
	sin_motivo: 'Sin motivo registrado'
};

// Explica que corregir, no solo como se llama el motivo (PLAN_FRONTEND.md
// seccion 7.5: la cola de revision existe para poder decir "hoy reviso
// todos los que no tienen cedula").
export const DESCRIPCION_MOTIVO: Record<string, string> = {
	sin_cedula: 'El OCR no encontro cedula para esta persona. Completa el campo Cedula.',
	sin_fecha: 'El OCR no encontro fecha en este documento. Completa el campo Fecha.',
	consecutivo_repetido: 'Ya existe otro documento activo con este mismo consecutivo. Verifica cual es el correcto.',
	consecutivo_fuera_de_tendencia:
		'Este consecutivo rompe la secuencia creciente/decreciente esperada — probable error de lectura. Verifica el numero contra el PDF.',
	consecutivo_no_numerico: 'El consecutivo leido no es un numero valido. Corrigelo contra el PDF.',
	sin_motivo: 'Este documento quedo marcado para revisar sin un motivo especifico registrado.'
};

export function formatoMotivo(motivo: string | null): string {
	if (!motivo) return ETIQUETA_MOTIVO.sin_motivo;
	return ETIQUETA_MOTIVO[motivo] ?? motivo;
}

export function descripcionMotivo(motivo: string | null): string {
	if (!motivo) return DESCRIPCION_MOTIVO.sin_motivo;
	return DESCRIPCION_MOTIVO[motivo] ?? 'Este documento quedo marcado para revisar.';
}
