<script lang="ts">
	import { buscarDocumentos } from '$lib/api/documentos';
	import type { DocumentoConRelaciones } from '$lib/types/modelos';
	import { formatoFecha, formatoTexto } from '$lib/utils/estadoDocumento';
	import { formatoMotivo, descripcionMotivo } from '$lib/utils/motivoRevisar';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';
	import Badge from '$lib/components/Badge.svelte';

	let documentos = $state<DocumentoConRelaciones[]>([]);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let gruposColapsados = $state<Record<string, boolean>>({});

	async function cargar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			const resultado = await buscarDocumentos({ revisar: true, page_size: 200 });
			documentos = resultado.resultados;
		} catch {
			error = 'No se pudo cargar la cola de revision';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargar();
	});

	const grupos = $derived.by(() => {
		const mapa = new Map<string, DocumentoConRelaciones[]>();
		for (const doc of documentos) {
			const motivo = doc.motivoRevisar ?? 'sin_motivo';
			if (!mapa.has(motivo)) mapa.set(motivo, []);
			mapa.get(motivo)!.push(doc);
		}
		return [...mapa.entries()].sort((a, b) => b[1].length - a[1].length);
	});

	function alternarGrupo(motivo: string): void {
		gruposColapsados = { ...gruposColapsados, [motivo]: !gruposColapsados[motivo] };
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">Control de calidad</p>
	<div class="flex flex-wrap items-baseline gap-3">
		<h1 class="titulo-pagina">Cola de revisión</h1>
		{#if !cargando && !error && documentos.length > 0}
			<span class="dato-mono text-xs text-(--texto-3)">{documentos.length} pendientes</span>
		{/if}
	</div>
</div>

{#if cargando}
	<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if documentos.length === 0}
	<EstadoVacio
		titulo="No hay nada pendiente de revisar 🎉"
		descripcion="Cuando el OCR marque un documento con dudas, aparecerá aquí agrupado por motivo."
	/>
{:else}
	<div class="flex flex-col gap-4">
		{#each grupos as [motivo, docs] (motivo)}
			{@const colapsado = gruposColapsados[motivo]}
			<div class="tarjeta overflow-hidden">
				<button
					class="flex w-full items-center justify-between gap-4 bg-(--superficie-2) px-5 py-3.5 text-left transition-colors hover:bg-(--superficie-3)"
					onclick={() => alternarGrupo(motivo)}
					aria-expanded={!colapsado}
				>
					<div>
						<span class="text-sm font-medium text-(--texto-1)">
							{formatoMotivo(motivo === 'sin_motivo' ? null : motivo)}
							<span class="dato-mono ml-1 text-xs text-(--texto-3)">({docs.length})</span>
						</span>
						<p class="mt-0.5 text-xs text-(--texto-3)">
							{descripcionMotivo(motivo === 'sin_motivo' ? null : motivo)}
						</p>
					</div>
					<svg
						viewBox="0 0 24 24"
						class="h-4 w-4 shrink-0 text-(--texto-3) transition-transform duration-150 {colapsado ? '-rotate-90' : ''}"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						<path d="m6 9 6 6 6-6" />
					</svg>
				</button>
				{#if !colapsado}
					<table class="tabla border-t border-(--borde)">
						<thead>
							<tr>
								<th>Consecutivo</th>
								<th>Cédula</th>
								<th>Nombre</th>
								<th>Fecha</th>
								<th>Motivo</th>
								<th></th>
							</tr>
						</thead>
						<tbody>
							{#each docs as doc (doc.id)}
								<tr>
									<td class="celda-clave">{doc.consecutivo}</td>
									<td class="dato-mono">{formatoTexto(doc.persona?.cedula)}</td>
									<td>{formatoTexto(doc.persona?.nombre)}</td>
									<td class="dato-mono">{formatoFecha(doc.fecha)}</td>
									<td>
										<Badge tono="amarillo" texto={formatoMotivo(doc.motivoRevisar)} titulo={descripcionMotivo(doc.motivoRevisar)} />
									</td>
									<td class="text-right">
										<a href="/documentos/{doc.id}/editar" class="enlace-accion">Corregir</a>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				{/if}
			</div>
		{/each}
	</div>
{/if}
