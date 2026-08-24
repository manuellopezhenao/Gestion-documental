import { writable } from 'svelte/store';

export type TipoToast = 'exito' | 'error' | 'info';

export interface Toast {
	id: number;
	tipo: TipoToast;
	mensaje: string;
}

export const toasts = writable<Toast[]>([]);

let contador = 0;

export function notificar(mensaje: string, tipo: TipoToast = 'info', duracionMs = 4000): void {
	const id = ++contador;
	toasts.update((actual) => [...actual, { id, tipo, mensaje }]);
	setTimeout(() => {
		toasts.update((actual) => actual.filter((t) => t.id !== id));
	}, duracionMs);
}
