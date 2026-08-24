export function formatoBytes(bytes: number | null): string {
	if (bytes === null) return '— sin dato —';
	if (bytes === 0) return '0 B';
	const unidades = ['B', 'KB', 'MB', 'GB', 'TB'];
	const indice = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), unidades.length - 1);
	const valor = bytes / 1024 ** indice;
	return `${indice === 0 ? valor : valor.toFixed(1)} ${unidades[indice]}`;
}
