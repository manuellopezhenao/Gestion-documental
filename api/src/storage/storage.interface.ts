export const STORAGE_TOKEN = 'STORAGE';

// Interfaz unica de acceso a archivos (ver PLAN_API.md seccion 6).
// La API y el job de OCR solo hablan con esto, nunca con fs/path directo,
// para poder pasar de "carpeta local" a S3/MinIO sin tocar el resto.
export interface Storage {
  guardar(rutaRelativa: string, datos: Buffer): Promise<void>;
  leer(rutaRelativa: string): Promise<Buffer>;
  existe(rutaRelativa: string): Promise<boolean>;
  eliminar(rutaRelativa: string): Promise<void>;
  // Ruta absoluta de la raiz de este storage (solo tiene sentido para
  // backends locales; ver PLAN_API.md seccion 16 / pantalla admin de
  // "Sistema").
  raiz(): string;
  estadisticas(): Promise<{ archivos: number; bytes: number }>;
}
