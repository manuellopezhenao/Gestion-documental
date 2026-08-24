<script lang="ts">
	import { goto } from '$app/navigation';
	import { obtenerAlmacenamiento } from '$lib/api/sistema';
	import { formatoBytes } from '$lib/utils/formatoBytes';
	import { notificar } from '$lib/stores/toasts';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import type { InfoAlmacenamiento } from '$lib/types/modelos';
	import Badge from '$lib/components/Badge.svelte';

	let info = $state<InfoAlmacenamiento | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	async function cargar(): Promise<void> {
		cargando = true;
		error = null;
		try {
			info = await obtenerAlmacenamiento();
		} catch {
			error = 'No se pudo cargar la información de almacenamiento';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		if (!tieneRol($rol, 'admin')) {
			void goto('/documentos');
			return;
		}
		void cargar();
	});

	async function copiar(texto: string | null): Promise<void> {
		if (!texto) return;
		try {
			await navigator.clipboard.writeText(texto);
			notificar('Ruta copiada al portapapeles', 'exito');
		} catch {
			notificar('No se pudo copiar', 'error');
		}
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">Sistema</p>
	<h1 class="titulo-pagina">Almacenamiento</h1>
	<p class="mt-1 max-w-2xl text-sm text-(--texto-2)">
		Dónde vive físicamente cada cosa en este servidor — útil para hacer un respaldo o migrar los datos a otro lado.
		Solo visible para administradores.
	</p>
</div>

{#if cargando}
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
		<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
	</div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if info}
	<div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
		<div class="tarjeta p-5">
			<div class="mb-4 flex items-center justify-between">
				<p class="eyebrow">Base de datos</p>
				<Badge tono="azul" texto={info.base_datos.proveedor} />
			</div>
			{#if info.base_datos.ruta}
				<p class="mb-1 text-xs text-(--texto-3)">Archivo</p>
				<div class="mb-4 flex items-center gap-2">
					<code class="dato-mono flex-1 truncate rounded-md border border-(--borde) bg-(--superficie-2) px-2.5 py-1.5 text-xs">
						{info.base_datos.ruta}
					</code>
					<button
						class="enlace-accion shrink-0 text-xs"
						onclick={() => copiar(info?.base_datos.ruta ?? null)}
						title="Copiar ruta"
					>
						Copiar
					</button>
				</div>
			{:else}
				<p class="mb-4 text-sm text-(--texto-3) italic">
					No es SQLite — gestioná el respaldo con las herramientas propias de ese motor.
				</p>
			{/if}
			<p class="mb-1 text-xs text-(--texto-3)">Tamaño</p>
			<p class="dato-mono text-lg font-medium text-(--texto-1)">{formatoBytes(info.base_datos.tamano_bytes)}</p>
		</div>

		<div class="tarjeta p-5">
			<div class="mb-4 flex items-center justify-between">
				<p class="eyebrow">Archivos (PDFs)</p>
				<Badge tono="azul" texto={info.storage.backend} />
			</div>
			<p class="mb-1 text-xs text-(--texto-3)">Carpeta</p>
			<div class="mb-4 flex items-center gap-2">
				<code class="dato-mono flex-1 truncate rounded-md border border-(--borde) bg-(--superficie-2) px-2.5 py-1.5 text-xs">
					{info.storage.ruta}
				</code>
				<button class="enlace-accion shrink-0 text-xs" onclick={() => copiar(info?.storage.ruta ?? null)} title="Copiar ruta">
					Copiar
				</button>
			</div>
			<div class="flex gap-8">
				<div>
					<p class="mb-1 text-xs text-(--texto-3)">Tamaño</p>
					<p class="dato-mono text-lg font-medium text-(--texto-1)">{formatoBytes(info.storage.tamano_bytes)}</p>
				</div>
				<div>
					<p class="mb-1 text-xs text-(--texto-3)">Archivos</p>
					<p class="dato-mono text-lg font-medium text-(--texto-1)">{info.storage.archivos.toLocaleString()}</p>
				</div>
			</div>
		</div>
	</div>
{/if}
