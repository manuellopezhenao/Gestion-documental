<script lang="ts">
	import { buscarPersonas } from '$lib/api/personas';
	import type { Persona, ResultadoBusqueda } from '$lib/types/modelos';
	import { formatoTexto } from '$lib/utils/estadoDocumento';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';
	import Paginacion from '$lib/components/Paginacion.svelte';
	import { claseInput } from '$lib/components/estilos';

	let q = $state('');
	let paginaActual = $state(1);
	let resultado = $state<ResultadoBusqueda<Persona> | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let temporizador: ReturnType<typeof setTimeout> | undefined;

	async function buscar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			resultado = await buscarPersonas(q || undefined, paginaActual, 50);
		} catch {
			error = 'No se pudieron cargar las personas';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void q;
		void paginaActual;
		void buscar();
	});

	function onTexto(valor: string): void {
		clearTimeout(temporizador);
		temporizador = setTimeout(() => {
			paginaActual = 1;
			q = valor;
		}, 300);
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">Directorio</p>
	<h1 class="titulo-pagina">Personas</h1>
</div>

<div class="relative mb-5 max-w-sm">
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
		placeholder="Buscar por cédula o nombre"
		oninput={(e) => onTexto(e.currentTarget.value)}
		class="{claseInput} pl-9"
		aria-label="Buscar personas"
	/>
</div>

{#if cargando}
	<div class="flex flex-col gap-2">
		{#each Array(6) as _}
			<div class="h-10 animate-pulse rounded-lg bg-(--superficie-3)"></div>
		{/each}
	</div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if resultado && resultado.resultados.length === 0}
	<EstadoVacio titulo="No hay personas con esta búsqueda" descripcion="Prueba con otra cédula u otro nombre." />
{:else if resultado}
	<div class="tabla-marco">
		<table class="tabla">
			<thead>
				<tr>
					<th>Cédula</th>
					<th>Nombre</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each resultado.resultados as persona (persona.id)}
					<tr>
						<td class="celda-clave">{formatoTexto(persona.cedula)}</td>
						<td>{formatoTexto(persona.nombre)}</td>
						<td class="text-right">
							<a href="/personas/{persona.id}" class="enlace-accion">Ver</a>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="mt-4">
		<Paginacion total={resultado.total} page={resultado.page} pageSize={resultado.page_size} onCambiar={(p) => (paginaActual = p)} />
	</div>
{/if}
