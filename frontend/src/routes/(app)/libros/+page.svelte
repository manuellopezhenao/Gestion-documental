<script lang="ts">
	import { goto } from '$app/navigation';
	import { listarLibros } from '$lib/api/libros';
	import type { Libro } from '$lib/types/modelos';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import Badge from '$lib/components/Badge.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';

	const TONO_ESTADO: Record<Libro['estado'], 'gris' | 'azul' | 'verde' | 'rojo'> = {
		pendiente: 'gris',
		procesando: 'azul',
		completado: 'verde',
		error: 'rojo'
	};

	let libros = $state<Libro[]>([]);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	async function cargar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			libros = await listarLibros();
		} catch {
			error = 'No se pudieron cargar los libros';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargar();
	});
</script>

<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
	<div>
		<p class="eyebrow mb-1.5">Fuentes del archivo</p>
		<h1 class="titulo-pagina">Libros</h1>
	</div>
	<Boton
		deshabilitado={!tieneRol($rol, 'admin')}
		tooltipDeshabilitado="Necesitas rol admin"
		onclick={() => goto('/libros/nuevo')}
	>
		+ Subir libro
	</Boton>
</div>

{#if cargando}
	<div class="flex flex-col gap-2">
		{#each Array(4) as _}
			<div class="h-16 animate-pulse rounded-xl bg-(--superficie-3)"></div>
		{/each}
	</div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if libros.length === 0}
	<EstadoVacio
		titulo="Todavía no se ha subido ningún libro"
		descripcion="Sube el PDF escaneado de un libro y el OCR lo dividirá en documentos individuales."
	/>
{:else}
	<div class="flex flex-col gap-3">
		{#each libros as libro (libro.id)}
			<a href="/libros/{libro.id}" class="tarjeta group flex items-center gap-4 p-4 transition-shadow duration-150 hover:shadow-md">
				<span
					class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-tinta-50 text-tinta-500 dark:bg-tinta-800 dark:text-tinta-300"
					aria-hidden="true"
				>
					<svg
						viewBox="0 0 24 24"
						class="h-5 w-5"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
					</svg>
				</span>
				<div class="min-w-0 flex-1">
					<p class="truncate font-medium text-(--texto-1)">{libro.nombreArchivo}</p>
					<div class="mt-1.5 flex flex-wrap items-center gap-3">
						<Badge tono={TONO_ESTADO[libro.estado]} texto={libro.estado} />
						<span class="dato-mono text-xs text-(--texto-3)">
							{libro.documentosGenerados} documento{libro.documentosGenerados === 1 ? '' : 's'}
							{#if libro.totalPaginas}
								· {libro.totalPaginas} páginas
							{/if}
						</span>
					</div>
				</div>
				<svg
					viewBox="0 0 24 24"
					class="h-4 w-4 shrink-0 text-(--texto-3) opacity-50 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:opacity-100"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					<path d="m9 18 6-6-6-6" />
				</svg>
			</a>
		{/each}
	</div>
{/if}
