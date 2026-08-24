<script lang="ts">
	import { page } from '$app/state';
	import { detallePersona, documentosDePersona } from '$lib/api/personas';
	import type { Persona, DocumentoConLibro } from '$lib/types/modelos';
	import { estadoDocumento, formatoFecha, formatoTexto } from '$lib/utils/estadoDocumento';
	import Badge from '$lib/components/Badge.svelte';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';

	const id = $derived(Number(page.params.id));

	let persona = $state<Persona | null>(null);
	let documentos = $state<DocumentoConLibro[]>([]);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	async function cargar(personaId: number): Promise<void> {
		cargando = true;
		error = null;
		try {
			[persona, documentos] = await Promise.all([detallePersona(personaId), documentosDePersona(personaId)]);
		} catch {
			error = 'No se pudo cargar la persona';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargar(id);
	});
</script>

{#if cargando}
	<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if persona}
	<div class="mb-6">
		<p class="eyebrow mb-1.5">
			<a href="/personas" class="hover:text-(--texto-1)">Personas</a> / Detalle
		</p>
		<h1 class="titulo-pagina">{formatoTexto(persona.nombre)}</h1>
		<p class="dato-mono mt-1 text-sm text-(--texto-3)">Cédula: {formatoTexto(persona.cedula)}</p>
	</div>

	{#if documentos.length === 0}
		<EstadoVacio titulo="Esta persona no tiene documentos activos" />
	{:else}
		<p class="dato-mono mb-2 text-xs text-(--texto-3)">
			{documentos.length} documento{documentos.length === 1 ? '' : 's'}
		</p>
		<div class="tabla-marco">
			<table class="tabla">
				<thead>
					<tr>
						<th>Consecutivo</th>
						<th>Fecha</th>
						<th>Estado</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each documentos as doc (doc.id)}
						{@const estado = estadoDocumento(doc.revisar, doc.motivoRevisar, doc.eliminadoEn)}
						<tr>
							<td class="celda-clave">{doc.consecutivo}</td>
							<td class="dato-mono">{formatoFecha(doc.fecha)}</td>
							<td><Badge tono={estado.tono} texto={estado.texto} titulo={estado.titulo} /></td>
							<td class="text-right">
								<a href="/documentos/{doc.id}" class="enlace-accion">Ver</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
{/if}
