<script lang="ts">
	import { listarLibros } from '$lib/api/libros';
	import { listarConsecutivos, huecosConsecutivos } from '$lib/api/documentos';
	import type { Libro, ConsecutivoResumen, Huecos } from '$lib/types/modelos';
	import Badge from '$lib/components/Badge.svelte';
	import { claseInput } from '$lib/components/estilos';

	let libros = $state<Libro[]>([]);
	let libroId = $state<string>('');
	let consecutivos = $state<ConsecutivoResumen[]>([]);
	let huecos = $state<Huecos | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	const TONO_ESTADO: Record<ConsecutivoResumen['estado'], 'verde' | 'amarillo' | 'rojo'> = {
		ok: 'verde',
		revisar: 'amarillo',
		duplicado: 'rojo'
	};

	async function cargarLibros(): Promise<void> {
		try {
			libros = await listarLibros();
		} catch {
			// el selector de libro es opcional; si falla, se sigue con el listado global
		}
	}

	async function cargar(idLibro: string): Promise<void> {
		cargando = true;
		error = null;
		try {
			const numero = idLibro ? Number(idLibro) : undefined;
			[consecutivos, huecos] = await Promise.all([listarConsecutivos(numero), huecosConsecutivos(numero)]);
		} catch {
			error = 'No se pudieron cargar los consecutivos';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargarLibros();
	});

	$effect(() => {
		void cargar(libroId);
	});
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<p class="eyebrow mb-1.5">Numeración</p>
		<h1 class="titulo-pagina">Consecutivos</h1>
	</div>
	<select bind:value={libroId} class="campo max-w-xs" aria-label="Filtrar por libro">
		<option value="">Todos los libros</option>
		{#each libros as libro (libro.id)}
			<option value={libro.id}>{libro.nombreArchivo}</option>
		{/each}
	</select>
</div>

{#if cargando}
	<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else}
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="tabla-marco lg:col-span-2">
			<table class="tabla">
				<thead>
					<tr>
						<th>Consecutivo</th>
						<th>Estado</th>
						<th></th>
					</tr>
				</thead>
				<tbody>
					{#each consecutivos as c (c.id)}
						<tr>
							<td class="celda-clave">{c.consecutivo}</td>
							<td><Badge tono={TONO_ESTADO[c.estado]} texto={c.estado} /></td>
							<td class="text-right">
								<a href="/documentos/{c.id}" class="enlace-accion">Ver</a>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<aside class="tarjeta h-fit p-5">
			<p class="eyebrow mb-3">Huecos detectados</p>
			{#if huecos?.rango}
				<p class="dato-mono text-xs text-(--texto-3)">Rango: {huecos.rango[0]} — {huecos.rango[1]}</p>
				{#if huecos.demasiado_grande}
					<p class="mt-3 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
						El rango es demasiado amplio para calcular huecos ({(huecos.rango[1] - huecos.rango[0]).toLocaleString()} de
						diferencia) - casi seguro que hay un consecutivo mal leido por OCR muy alejado del resto. Revisalo en
						<a href="/documentos" class="underline">Documentos</a> ordenando por consecutivo.
					</p>
				{:else if huecos.faltantes.length === 0}
					<p class="mt-3 text-sm font-medium text-emerald-700 dark:text-emerald-400">
						No hay números faltantes en este rango.
					</p>
				{:else}
					<p class="mt-3 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
						Un hueco no siempre es un error — puede ser una anulación legítima.
					</p>
					<div class="mt-3 flex flex-wrap gap-1.5">
						{#each huecos.faltantes.slice(0, 500) as n (n)}
							<span
								class="dato-mono rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[11px] text-amber-800 dark:border-amber-800/60 dark:bg-amber-900/30 dark:text-amber-300"
							>
								{n}
							</span>
						{/each}
					</div>
					{#if huecos.faltantes.length > 500}
						<p class="mt-2 text-xs text-(--texto-3)">
							Mostrando los primeros 500 de {huecos.faltantes.length} huecos.
						</p>
					{/if}
				{/if}
			{:else}
				<p class="text-sm text-(--texto-3)">Sin datos suficientes para calcular un rango.</p>
			{/if}
		</aside>
	</div>
{/if}
