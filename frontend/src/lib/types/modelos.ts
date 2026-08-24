// Tipos de respuesta escritos a mano a partir de las entidades reales de
// Prisma (api/prisma/schema.prisma) y los servicios de la API
// (api/src/**/*.service.ts). El OpenAPI que expone Nest (`openapi-typescript`,
// ver npm run generar-tipos-api -> src/lib/types/api.d.ts) todavia no declara
// @ApiOkResponse en los controllers, asi que no describe las respuestas -
// solo los DTO de entrada (bodies/query). Si algun dia se agregan esas
// anotaciones en la API, estos tipos se pueden reemplazar por los generados.

export type Rol = 'admin' | 'editor' | 'lector';

export interface Persona {
	id: number;
	cedula: string | null;
	nombre: string | null;
	creadoEn: string;
	actualizadoEn: string;
}

export interface Libro {
	id: number;
	nombreArchivo: string;
	rutaOrigen: string;
	periodoLibro: string | null;
	totalPaginas: number | null;
	documentosGenerados: number;
	consecutivoMin: number | null;
	consecutivoMax: number | null;
	estado: 'pendiente' | 'procesando' | 'completado' | 'error';
	errorDetalle: string | null;
	iniciadoEn: string | null;
	finalizadoEn: string | null;
}

export interface Documento {
	id: number;
	libroId: number | null;
	origen: 'ocr' | 'manual';
	personaId: number | null;
	consecutivo: string;
	consecutivoNum: number | null;
	fecha: string | null;
	periodoLibro: string | null;
	revisar: boolean;
	motivoRevisar: string | null;
	paginaInicio: number;
	paginaFin: number;
	archivoPath: string;
	tamanoBytes: number | null;
	hashSha256: string | null;
	procesadoEn: string;
	eliminadoEn: string | null;
}

export interface DocumentoConRelaciones extends Documento {
	persona: Persona | null;
	libro: Libro | null;
}

export interface DocumentoConPersona extends Documento {
	persona: Persona | null;
}

export interface DocumentoConLibro extends Documento {
	libro: Libro | null;
}

export interface ResultadoBusqueda<T> {
	total: number;
	page: number;
	page_size: number;
	resultados: T[];
}

export interface ConsecutivoResumen {
	id: number;
	consecutivo: string;
	estado: 'ok' | 'revisar' | 'duplicado';
}

export interface Huecos {
	rango: [number, number] | null;
	faltantes: number[];
	demasiado_grande: boolean;
}

export interface ReporteResumen {
	total_documentos: number;
	pendientes_revisar: number;
	personas_sin_cedula: number;
	libros_con_errores: number;
	documentos_por_mes: { mes: string; total: number }[];
}

export interface HealthEstado {
	estado: 'ok' | 'degradado';
	base_datos: 'ok' | 'error';
	storage: 'ok' | 'error';
}

export interface ErrorApi {
	error: string;
	mensaje: string;
	detalle: unknown;
}

export type AccionAuditoria =
	| 'ver'
	| 'descargar'
	| 'editar'
	| 'eliminar'
	| 'eliminar_libro'
	| 'subir_libro'
	| 'reanudar_libro'
	| 'subir_documento_manual'
	| 'dividir_documento'
	| 'login';

export interface VersionArchivo {
	indice: number;
	fecha: string;
	usuario: { id: number; email: string; rol: Rol } | null;
	vigente: boolean;
}

export interface InfoAlmacenamiento {
	base_datos: {
		proveedor: string;
		ruta: string | null;
		tamano_bytes: number | null;
	};
	storage: {
		backend: string;
		ruta: string;
		archivos: number;
		tamano_bytes: number;
	};
}

export interface RegistroAuditoria {
	id: number;
	accion: string;
	fecha: string;
	detalle: unknown;
	usuario: { id: number; email: string; rol: Rol } | null;
	documento: { id: number; consecutivo: string } | null;
}

export const MOTIVOS_REVISAR = [
	'sin_cedula',
	'sin_fecha',
	'consecutivo_repetido',
	'consecutivo_fuera_de_tendencia',
	'consecutivo_no_numerico',
] as const;
