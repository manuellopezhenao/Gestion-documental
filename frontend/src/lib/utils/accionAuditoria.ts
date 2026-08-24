export const ETIQUETA_ACCION: Record<string, string> = {
	ver: 'Ver',
	descargar: 'Descargar',
	editar: 'Editar',
	eliminar: 'Eliminar',
	eliminar_libro: 'Eliminar libro',
	subir_libro: 'Subir libro',
	reanudar_libro: 'Reanudar libro',
	subir_documento_manual: 'Subir documento manual',
	dividir_documento: 'Dividir documento',
	login: 'Inicio de sesión'
};

export const TONO_ACCION: Record<string, 'verde' | 'amarillo' | 'rojo' | 'gris' | 'azul'> = {
	ver: 'gris',
	descargar: 'gris',
	editar: 'amarillo',
	eliminar: 'rojo',
	eliminar_libro: 'rojo',
	subir_libro: 'verde',
	reanudar_libro: 'azul',
	subir_documento_manual: 'verde',
	dividir_documento: 'azul',
	login: 'azul'
};

export function etiquetaAccion(accion: string): string {
	return ETIQUETA_ACCION[accion] ?? accion;
}

export function tonoAccion(accion: string): 'verde' | 'amarillo' | 'rojo' | 'gris' | 'azul' {
	return TONO_ACCION[accion] ?? 'gris';
}
