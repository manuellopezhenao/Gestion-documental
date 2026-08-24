<script lang="ts">
	interface Props {
		tono?: 'verde' | 'amarillo' | 'rojo' | 'gris' | 'azul';
		texto: string;
		titulo?: string;
	}
	let { tono = 'gris', texto, titulo }: Props = $props();

	const clases: Record<string, string> = {
		verde:
			'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-900/30 dark:text-emerald-300',
		amarillo:
			'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300',
		rojo: 'border-sello-100 bg-sello-50 text-sello-700 dark:border-sello-700/50 dark:bg-sello-700/20 dark:text-[#e8988e]',
		gris: 'border-(--borde) bg-(--superficie-2) text-(--texto-2)',
		azul: 'border-tinta-200 bg-tinta-50 text-tinta-700 dark:border-tinta-700 dark:bg-tinta-800/60 dark:text-tinta-200'
	};
</script>

<span
	title={titulo}
	class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-medium tracking-wide {clases[
		tono
	]}"
>
	<span class="h-1.5 w-1.5 rounded-full bg-current opacity-60" aria-hidden="true"></span>
	{texto}
</span>
