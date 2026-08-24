<script lang="ts">
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { detalleLibro, estadoLibro, documentosDeLibro, reanudarLibro, eliminarLibro } from '$lib/api/libros';
	import { ApiError } from '$lib/api/apiFetch';
	import type { Libro, DocumentoConPersona } from '$lib/types/modelos';
	import { estadoDocumento, formatoFecha, formatoTexto } from '$lib/utils/estadoDocumento';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import { notificar } from '$lib/stores/toasts';
	import Badge from '$lib/components/Badge.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import EstadoVacio from '$lib/components/EstadoVacio.svelte';

	const TONO_ESTADO: Record<Libro['estado'], 'gris' | 'azul' | 'verde' | 'rojo'> = {
		pendiente: 'gris',
		procesando: 'azul',
		completado: 'verde',
		error: 'rojo'
	};

	const id = $derived(Number(page.params.id));

	let libro = $state<Libro | null>(null);
	let documentos = $state<DocumentoConPersona[]>([]);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let mostrarDetalleError = $state(false);
	let mostrarConfirmarReanudar = $state(false);
	let reanudando = $state(false);
	let mostrarConfirmarEliminar = $state(false);
	let eliminando = $state(false);

	let intervaloPolling: ReturnType<typeof setInterval> | undefined;

	function detenerPolling(): void {
		if (intervaloPolling) {
			clearInterval(intervaloPolling);
			intervaloPolling = undefined;
		}
	}

	function iniciarPollingSiHaceFalta(): void {
		detenerPolling();
		if (libro?.estado !== 'procesando') return;
		intervaloPolling = setInterval(async () => {
			try {
				const [actualizado, documentosActualizados] = await Promise.all([estadoLibro(id), documentosDeLibro(id)]);
				libro = actualizado;
				documentos = documentosActualizados;
				if (actualizado.estado !== 'procesando') {
					detenerPolling();
				}
			} catch {
				detenerPolling();
			}
		}, 5000);
	}

	async function cargar(libroId: number): Promise<void> {
		cargando = true;
		error = null;
		try {
			[libro, documentos] = await Promise.all([detalleLibro(libroId), documentosDeLibro(libroId)]);
			iniciarPollingSiHaceFalta();
		} catch {
			error = 'No se pudo cargar el libro';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargar(id);
	});

	onDestroy(detenerPolling);

	// documentosGenerados no es comparable contra totalPaginas: un documento
	// puede ocupar varias paginas, asi que "81 de 381" haria parecer que
	// falta el 79% cuando en realidad ya estan los 81 completos. La metrica
	// correcta es cuantas paginas del PDF ya se leyeron, que se deduce del
	// pagina_fin mas alto entre los documentos ya generados.
	let paginasLeidas = $derived(
		documentos.length > 0 ? Math.max(...documentos.map((d) => d.paginaFin + 1)) : 0
	);

	async function confirmarReanudar(): Promise<void> {
		if (!libro) return;
		reanudando = true;
		try {
			libro = await reanudarLibro(libro.id);
			notificar('Libro en reanudacion', 'exito');
			iniciarPollingSiHaceFalta();
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo reanudar el libro', 'error');
		} finally {
			reanudando = false;
			mostrarConfirmarReanudar = false;
		}
	}

	async function confirmarEliminar(): Promise<void> {
		if (!libro) return;
		eliminando = true;
		try {
			const resultado = await eliminarLibro(libro.id);
			notificar(`Libro eliminado junto con ${resultado.documentosEliminados} documento(s)`, 'exito');
			await goto('/libros');
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo eliminar el libro', 'error');
		} finally {
			eliminando = false;
			mostrarConfirmarEliminar = false;
		}
	}
</script>

{#if cargando}
	<div class="h-48 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if libro}
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div class="min-w-0">
			<p class="eyebrow mb-1.5">
				<a href="/libros" class="hover:text-(--texto-1)">Libros</a> / Detalle
			</p>
			<h1 class="titulo-pagina break-all">{libro.nombreArchivo}</h1>
			<div class="mt-2 flex items-center gap-3">
				<Badge tono={TONO_ESTADO[libro.estado]} texto={libro.estado} />
				{#if libro.estado === 'procesando'}
					<span class="dato-mono text-xs text-(--texto-3)">Actualizando cada 5s…</span>
				{/if}
			</div>
		</div>
		<div class="flex shrink-0 gap-2">
			{#if libro.estado === 'error'}
				<Boton
					variante="peligro"
					deshabilitado={!tieneRol($rol, 'admin')}
					tooltipDeshabilitado="Necesitas rol admin"
					onclick={() => (mostrarConfirmarReanudar = true)}
				>
					Reanudar
				</Boton>
			{/if}
			<Boton
				variante="peligro"
				deshabilitado={!tieneRol($rol, 'admin') || libro.estado === 'procesando'}
				tooltipDeshabilitado={!tieneRol($rol, 'admin')
					? 'Necesitas rol admin'
					: 'No se puede eliminar mientras esta procesando'}
				onclick={() => (mostrarConfirmarEliminar = true)}
			>
				Eliminar libro
			</Boton>
		</div>
	</div>

	{#if libro.totalPaginas}
		<div class="tarjeta mb-6 max-w-md p-4">
			<div class="mb-2 flex items-baseline justify-between">
				<p class="eyebrow">Progreso de lectura</p>
				<span class="dato-mono text-xs font-medium text-(--texto-1)">
					{Math.min(100, Math.round((paginasLeidas / libro.totalPaginas) * 100))}%
				</span>
			</div>
			<div class="h-2 overflow-hidden rounded-full bg-(--superficie-3)">
				<div
					class="h-full rounded-full bg-tinta-600 transition-[width] duration-500 dark:bg-tinta-300"
					style="width: {Math.min(100, (paginasLeidas / libro.totalPaginas) * 100)}%"
				></div>
			</div>
			<p class="dato-mono mt-2 text-xs text-(--texto-3)">
				{paginasLeidas} de {libro.totalPaginas} páginas leídas — {libro.documentosGenerados} documento{libro.documentosGenerados ===
				1
					? ''
					: 's'} generado{libro.documentosGenerados === 1 ? '' : 's'}
			</p>
		</div>
	{:else}
		<p class="dato-mono mb-6 text-sm text-(--texto-3)">
			{libro.documentosGenerados} documento{libro.documentosGenerados === 1 ? '' : 's'} generado{libro.documentosGenerados ===
			1
				? ''
				: 's'}
		</p>
	{/if}

	{#if libro.estado === 'error' && libro.errorDetalle}
		<div class="tarjeta mb-6 border-l-4 border-l-sello-500 p-4">
			<button
				class="text-sm font-medium text-sello-600 hover:underline dark:text-sello-500"
				onclick={() => (mostrarDetalleError = !mostrarDetalleError)}
			>
				{mostrarDetalleError ? 'Ocultar' : 'Ver'} detalle del error
			</button>
			{#if mostrarDetalleError}
				<pre class="dato-mono mt-2 max-h-64 overflow-auto rounded-lg bg-(--superficie-2) p-3 text-xs whitespace-pre-wrap text-(--texto-2)">{libro.errorDetalle}</pre>
			{/if}
		</div>
	{/if}

	<p class="eyebrow mb-3">Documentos de este libro</p>
	{#if documentos.length === 0}
		<EstadoVacio titulo="Todavía no hay documentos generados de este libro" />
	{:else}
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
					{#each documentos as doc (doc.id)}
						{@const estado = estadoDocumento(doc.revisar, doc.motivoRevisar, doc.eliminadoEn)}
						<tr>
							<td class="celda-clave">{doc.consecutivo}</td>
							<td class="dato-mono">{formatoTexto(doc.persona?.cedula)}</td>
							<td>{formatoTexto(doc.persona?.nombre)}</td>
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

	<Modal
		abierto={mostrarConfirmarReanudar}
		titulo="Reanudar libro"
		confirmarTexto={reanudando ? 'Reanudando…' : 'Reanudar'}
		onconfirmar={confirmarReanudar}
		oncancelar={() => (mostrarConfirmarReanudar = false)}
	>
		Esto va a continuar el procesamiento desde la última página que alcanzó a completarse, no desde el inicio del
		libro. ¿Continuar?
	</Modal>

	<Modal
		abierto={mostrarConfirmarEliminar}
		titulo="Eliminar libro"
		confirmarTexto={eliminando ? 'Eliminando…' : 'Eliminar todo'}
		confirmarVariante="peligro"
		onconfirmar={confirmarEliminar}
		oncancelar={() => (mostrarConfirmarEliminar = false)}
	>
		Esto borra <strong>{libro.nombreArchivo}</strong> por completo: los {libro.documentosGenerados} documento{libro.documentosGenerados ===
		1
			? ''
			: 's'} generados, sus PDF individuales, el PDF original subido, y el registro del libro. A diferencia de borrar
		un documento suelto, esto <strong>no se puede deshacer</strong>. ¿Continuar?
	</Modal>
{/if}
