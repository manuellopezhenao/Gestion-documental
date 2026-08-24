<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { buscarAuditoria } from '$lib/api/auditoria';
	import type { RegistroAuditoria, ResultadoBusqueda } from '$lib/types/modelos';
	import { etiquetaAccion, tonoAccion } from '$lib/utils/accionAuditoria';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import Badge from '$lib/components/Badge.svelte';
	import Paginacion from '$lib/components/Paginacion.svelte';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';
	import { claseInput } from '$lib/components/estilos';

	const ACCIONES = [
		'ver',
		'descargar',
		'editar',
		'eliminar',
		'eliminar_libro',
		'subir_libro',
		'reanudar_libro',
		'subir_documento_manual',
		'dividir_documento',
		'login'
	];

	function leerFiltrosDeUrl(params: URLSearchParams) {
		return {
			accion: params.get('accion') ?? '',
			fecha_desde: params.get('fecha_desde') ?? '',
			fecha_hasta: params.get('fecha_hasta') ?? '',
			page: Number(params.get('page') ?? '1'),
			page_size: 50
		};
	}

	let filtros = $state(leerFiltrosDeUrl(page.url.searchParams));
	let resultado = $state<ResultadoBusqueda<RegistroAuditoria> | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	function actualizarUrl(): void {
		const params = new URLSearchParams();
		for (const [clave, valor] of Object.entries(filtros)) {
			if (valor !== '' && valor !== undefined && valor !== null && !(clave === 'page' && valor === 1) && clave !== 'page_size') {
				params.set(clave, String(valor));
			}
		}
		void goto(`?${params.toString()}`, { replaceState: true, keepFocus: true, noScroll: true });
	}

	async function buscar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			resultado = await buscarAuditoria({
				accion: filtros.accion || undefined,
				fecha_desde: filtros.fecha_desde || undefined,
				fecha_hasta: filtros.fecha_hasta || undefined,
				page: filtros.page,
				page_size: filtros.page_size
			});
		} catch {
			error = 'No se pudo cargar el historial de auditoría';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		if (!tieneRol($rol, 'admin')) {
			void goto('/documentos');
		}
	});

	$effect(() => {
		if (!tieneRol($rol, 'admin')) return;
		actualizarUrl();
		void buscar();
	});

	function limpiarFiltros(): void {
		filtros = { ...leerFiltrosDeUrl(new URLSearchParams()) };
	}

	function cambiarPagina(pagina: number): void {
		filtros.page = pagina;
	}

	function formatoFechaHora(fecha: string): string {
		return new Date(fecha).toLocaleString('es-CO', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	function resumenDetalle(detalle: unknown): string | null {
		if (!detalle) return null;
		try {
			return JSON.stringify(detalle);
		} catch {
			return null;
		}
	}

	const hayFiltros = $derived(Boolean(filtros.accion || filtros.fecha_desde || filtros.fecha_hasta));
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">Sistema</p>
	<h1 class="titulo-pagina">Auditoría</h1>
	<p class="mt-1 text-sm text-(--texto-2)">
		Historial de quién hizo qué y cuándo — ver, descargar, editar, eliminar y cargar documentos. Solo visible para
		administradores.
	</p>
</div>

<div class="tarjeta mb-5 p-4">
	<div class="mb-3 flex items-center justify-between">
		<p class="eyebrow">Filtros</p>
		{#if hayFiltros}
			<button class="enlace-accion text-xs" onclick={limpiarFiltros}>Limpiar filtros</button>
		{/if}
	</div>
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
		<select bind:value={filtros.accion} class={claseInput} aria-label="Acción">
			<option value="">Todas las acciones</option>
			{#each ACCIONES as accion (accion)}
				<option value={accion}>{etiquetaAccion(accion)}</option>
			{/each}
		</select>
		<input type="date" bind:value={filtros.fecha_desde} class={claseInput} aria-label="Fecha desde" />
		<input type="date" bind:value={filtros.fecha_hasta} class={claseInput} aria-label="Fecha hasta" />
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
	<EstadoVacio titulo="No hay registros con estos filtros" descripcion="Probá con menos filtros o un rango de fechas más amplio." />
{:else if resultado}
	<p class="dato-mono mb-2 text-xs text-(--texto-3)">{resultado.total.toLocaleString()} registros</p>
	<div class="tabla-marco">
		<table class="tabla">
			<thead>
				<tr>
					<th>Fecha</th>
					<th>Usuario</th>
					<th>Acción</th>
					<th>Documento</th>
					<th>Detalle</th>
				</tr>
			</thead>
			<tbody>
				{#each resultado.resultados as registro (registro.id)}
					{@const detalle = resumenDetalle(registro.detalle)}
					<tr>
						<td class="dato-mono text-xs whitespace-nowrap">{formatoFechaHora(registro.fecha)}</td>
						<td>
							{#if registro.usuario}
								<span class="text-sm">{registro.usuario.email}</span>
							{:else}
								<span class="text-sm text-(--texto-3) italic">Pipeline OCR</span>
							{/if}
						</td>
						<td><Badge tono={tonoAccion(registro.accion)} texto={etiquetaAccion(registro.accion)} /></td>
						<td>
							{#if registro.documento}
								<a href="/documentos/{registro.documento.id}" class="enlace-accion dato-mono">
									{registro.documento.consecutivo}
								</a>
							{:else}
								<span class="text-(--texto-3)">—</span>
							{/if}
						</td>
						<td class="max-w-xs">
							{#if detalle}
								<span class="dato-mono block truncate text-xs text-(--texto-3)" title={detalle}>{detalle}</span>
							{:else}
								<span class="text-(--texto-3)">—</span>
							{/if}
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
