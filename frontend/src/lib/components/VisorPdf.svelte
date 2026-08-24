<script lang="ts">
	import { onDestroy, untrack } from 'svelte';
	import { archivoDocumento } from '$lib/api/documentos';

	interface Props {
		documentoId: number;
		nombreArchivo: string;
	}
	let { documentoId, nombreArchivo }: Props = $props();

	let objectUrl = $state<string | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	function limpiar(): void {
		if (objectUrl) {
			URL.revokeObjectURL(objectUrl);
			objectUrl = null;
		}
	}

	async function cargar(id: number): Promise<void> {
		cargando = true;
		error = null;
		limpiar();
		try {
			const blob = await archivoDocumento(id, 'inline');
			objectUrl = URL.createObjectURL(blob);
		} catch {
			error = 'No se pudo cargar el PDF';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		const idActual = documentoId;
		untrack(() => void cargar(idActual));
	});

	onDestroy(limpiar);
</script>

<div class="flex h-full flex-col gap-2">
	<div class="flex items-center justify-between gap-3">
		<span class="dato-mono truncate text-xs text-(--texto-3)">{nombreArchivo}</span>
		{#if objectUrl}
			<div class="flex shrink-0 gap-3">
				<a class="enlace-accion inline-flex items-center gap-1.5 text-xs" href={objectUrl} target="_blank" rel="noopener">
					<svg
						viewBox="0 0 24 24"
						class="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
					</svg>
					Abrir en pestaña nueva
				</a>
				<a class="enlace-accion inline-flex items-center gap-1.5 text-xs" href={objectUrl} download={nombreArchivo}>
					<svg
						viewBox="0 0 24 24"
						class="h-3.5 w-3.5"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line
							x1="12"
							x2="12"
							y1="15"
							y2="3"
						/>
					</svg>
					Descargar
				</a>
			</div>
		{/if}
	</div>
	<div class="tarjeta min-h-[70vh] flex-1 overflow-hidden">
		{#if cargando}
			<div class="flex h-full items-center justify-center text-sm text-(--texto-3)">Cargando PDF…</div>
		{:else if error}
			<div class="flex h-full items-center justify-center text-sm font-medium text-sello-600">{error}</div>
		{:else if objectUrl}
			<iframe title="Visor de PDF" src={objectUrl} class="h-full w-full"></iframe>
		{/if}
	</div>
</div>
