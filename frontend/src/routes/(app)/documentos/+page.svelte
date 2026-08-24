<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { buscarDocumentos } from '$lib/api/documentos';
	import type { DocumentoConRelaciones, ResultadoBusqueda } from '$lib/types/modelos';
	import { estadoDocumento, formatoFecha, formatoTexto } from '$lib/utils/estadoDocumento';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import Badge from '$lib/components/Badge.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import Paginacion from '$lib/components/Paginacion.svelte';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';
	import { claseInput } from '$lib/components/estilos';

	function leerFiltrosDeUrl(params: URLSearchParams) {
		return {
			q: params.get('q') ?? '',
			consecutivo: params.get('consecutivo') ?? '',
			cedula: params.get('cedula') ?? '',
			nombre: params.get('nombre') ?? '',
			fecha_desde: params.get('fecha_desde') ?? '',
			fecha_hasta: params.get('fecha_hasta') ?? '',
			periodo: params.get('periodo') ?? '',
			revisar: params.get('revisar') ?? '',
			motivo_revisar: params.get('motivo_revisar') ?? '',
			page: Number(params.get('page') ?? '1'),
			page_size: Number(params.get('page_size') ?? '50')
		};
	}

	let filtros = $state(leerFiltrosDeUrl(page.url.searchParams));
	let resultado = $state<ResultadoBusqueda<DocumentoConRelaciones> | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let temporizadorDebounce: ReturnType<typeof setTimeout> | undefined;

	function actualizarUrl(): void {
		const params = new URLSearchParams();
		for (const [clave, valor] of Object.entries(filtros)) {
			if (valor !== '' && valor !== undefined && valor !== null && !(clave === 'page' && valor === 1)) {
				params.set(clave, String(valor));
			}
		}
		void goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function buscar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			resultado = await buscarDocumentos({
				q: filtros.q || undefined,
				consecutivo: filtros.consecutivo || undefined,
				cedula: filtros.cedula || undefined,
				nombre: filtros.nombre || undefined,
				fecha_desde: filtros.fecha_desde || undefined,
				fecha_hasta: filtros.fecha_hasta || undefined,
				periodo: filtros.periodo || undefined,
				revisar: filtros.revisar === '' ? undefined : filtros.revisar === 'true',
				motivo_revisar: filtros.motivo_revisar || undefined,
				page: filtros.page,
				page_size: filtros.page_size
			});
		} catch {
			error = 'No se pudieron cargar los documentos';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		actualizarUrl();
		void buscar();
	});

	function onCampoTextoLibre(valor: string): void {
		clearTimeout(temporizadorDebounce);
		temporizadorDebounce = setTimeout(() => {
			filtros.page = 1;
			filtros.q = valor;
		}, 300);
	}

	function limpiarFiltros(): void {
		filtros = { ...leerFiltrosDeUrl(new URLSearchParams()) };
	}

	function cambiarPagina(pagina: number): void {
		filtros.page = pagina;
	}

	const hayFiltros = $derived(
		Boolean(
			filtros.q ||
				filtros.consecutivo ||
				filtros.cedula ||
				filtros.nombre ||
				filtros.fecha_desde ||
				filtros.fecha_hasta ||
				filtros.periodo ||
				filtros.revisar
		)
	);
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<p class="eyebrow mb-1.5">Archivo</p>
		<h1 class="titulo-pagina">Documentos</h1>
	</div>
	<Boton
		deshabilitado={!tieneRol($rol, 'editor')}
		tooltipDeshabilitado="Necesitas rol editor"
		onclick={() => goto('/documentos/nuevo')}
	>
		+ Cargar documento
	</Boton>
</div>

<div class="tarjeta mb-5 p-4">
	<div class="mb-3 flex items-center justify-between">
		<p class="eyebrow">Filtros</p>
		{#if hayFiltros}
			<button class="enlace-accion text-xs" onclick={limpiarFiltros}>Limpiar filtros</button>
		{/if}
	</div>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
		<div class="relative sm:col-span-2 lg:col-span-1">
			<svg
				viewBox="0 0 24 24"
				class="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-(--texto-3)"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				<circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
			</svg>
			<input
				placeholder="Buscar consecutivo, cédula o nombre"
				value={filtros.q}
				oninput={(e) => onCampoTextoLibre(e.currentTarget.value)}
				class="{claseInput} pl-9"
				aria-label="Búsqueda libre"
			/>
		</div>
		<input placeholder="Consecutivo exacto" bind:value={filtros.consecutivo} class={claseInput} aria-label="Consecutivo exacto" />
		<input placeholder="Cédula" bind:value={filtros.cedula} class={claseInput} aria-label="Cédula" />
		<input placeholder="Nombre" bind:value={filtros.nombre} class={claseInput} aria-label="Nombre" />
		<input type="date" bind:value={filtros.fecha_desde} class={claseInput} aria-label="Fecha desde" />
		<input type="date" bind:value={filtros.fecha_hasta} class={claseInput} aria-label="Fecha hasta" />
		<input placeholder="Periodo (AAAA-MM)" bind:value={filtros.periodo} class={claseInput} aria-label="Periodo" />
		<select bind:value={filtros.revisar} class={claseInput} aria-label="Estado">
			<option value="">Todos los estados</option>
			<option value="true">Solo revisar</option>
			<option value="false">Solo ok</option>
		</select>
	</div>
</div>

{#if cargando}
	<div class="flex flex-col gap-2">
		{#each Array(6) as _}
			<div class="h-12 animate-pulse rounded-lg bg-(--superficie-3)"></div>
		{/each}
	</div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if resultado && resultado.resultados.length === 0}
	<EstadoVacio titulo="No hay documentos con estos filtros" descripcion="Prueba con menos filtros o revisa la ortografía.">
		{#snippet accion()}
			<Boton variante="secundario" onclick={limpiarFiltros}>Limpiar filtros</Boton>
		{/snippet}
	</EstadoVacio>
{:else if resultado}
	<p class="dato-mono mb-2 text-xs text-(--texto-3)">{resultado.total.toLocaleString()} resultados</p>
	<div class="tabla-marco">
		<table class="tabla">
			<thead>
				<tr>
					<th>Consecutivo</th>
					<th>Cédula</th>
					<th>Nombre</th>
					<th>Fecha</th>
					<th>Estado</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each resultado.resultados as doc (doc.id)}
					{@const estado = estadoDocumento(doc.revisar, doc.motivoRevisar, doc.eliminadoEn)}
					<tr>
						<td class="celda-clave">{doc.consecutivo}</td>
						<td class="dato-mono">{formatoTexto(doc.persona?.cedula)}</td>
						<td>{formatoTexto(doc.persona?.nombre)}</td>
						<td class="dato-mono">{formatoFecha(doc.fecha)}</td>
						<td>
							<div class="flex gap-1.5">
								<Badge tono={estado.tono} texto={estado.texto} titulo={estado.titulo} />
								{#if doc.origen === 'manual'}
									<Badge tono="azul" texto="manual" />
								{/if}
							</div>
						</td>
						<td class="text-right">
							<a href="/documentos/{doc.id}" class="enlace-accion">Ver</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Paginacion total={resultado.total} page={resultado.page} pageSize={resultado.page_size} onCambiar={cambiarPagina} />
	</div>
{/if}
