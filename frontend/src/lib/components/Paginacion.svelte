<script lang="ts">
	interface Props {
		total: number;
		page: number;
		pageSize: number;
		onCambiar: (pagina: number) => void;
	}
	let { total, page, pageSize, onCambiar }: Props = $props();
	let totalPaginas = $derived(Math.max(1, Math.ceil(total / pageSize)));
</script>

{#if total > pageSize}
	<div class="flex items-center justify-between">
		<span class="font-mono text-xs tracking-wide text-(--texto-3)">
			Página {page} de {totalPaginas} · {total.toLocaleString()} resultados
		</span>
		<div class="flex gap-2">
			<button class="btn btn-secundario px-2.5 py-1 text-xs" disabled={page <= 1} onclick={() => onCambiar(page - 1)}>
				← Anterior
			</button>
			<button
				class="btn btn-secundario px-2.5 py-1 text-xs"
				disabled={page >= totalPaginas}
				onclick={() => onCambiar(page + 1)}
			>
				Siguiente →
			</button>
		</div>
	</div>
{/if}
