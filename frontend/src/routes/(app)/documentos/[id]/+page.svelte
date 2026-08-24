<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { detalleDocumento, eliminarDocumento, versionesDocumento, archivoVersion } from '$lib/api/documentos';
	import { ApiError } from '$lib/api/apiFetch';
	import type { DocumentoConRelaciones, VersionArchivo } from '$lib/types/modelos';
	import { estadoDocumento, formatoFecha, formatoTexto } from '$lib/utils/estadoDocumento';
	import { formatoMotivo, descripcionMotivo } from '$lib/utils/motivoRevisar';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import { notificar } from '$lib/stores/toasts';
	import Badge from '$lib/components/Badge.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import Modal from '$lib/components/Modal.svelte';
	import VisorPdf from '$lib/components/VisorPdf.svelte';

	const id = $derived(Number(page.params.id));

	let documento = $state<DocumentoConRelaciones | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);
	let mostrarConfirmarEliminar = $state(false);
	let eliminando = $state(false);
	let versiones = $state<VersionArchivo[]>([]);
	let cargandoVersion = $state<number | null>(null);

	async function cargar(docId: number): Promise<void> {
		cargando = true;
		error = null;
		try {
			documento = await detalleDocumento(docId);
		} catch {
			error = 'No se pudo cargar el documento';
		} finally {
			cargando = false;
		}
	}

	async function cargarVersiones(docId: number): Promise<void> {
		try {
			versiones = await versionesDocumento(docId);
		} catch {
			versiones = [];
		}
	}

	$effect(() => {
		void cargar(id);
		void cargarVersiones(id);
	});

	async function verVersion(indice: number): Promise<void> {
		if (!documento) return;
		cargandoVersion = indice;
		try {
			const blob = await archivoVersion(documento.id, indice, 'inline');
			const url = URL.createObjectURL(blob);
			window.open(url, '_blank', 'noopener');
			setTimeout(() => URL.revokeObjectURL(url), 60_000);
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo abrir esa versión', 'error');
		} finally {
			cargandoVersion = null;
		}
	}

	async function confirmarEliminar(): Promise<void> {
		if (!documento) return;
		eliminando = true;
		try {
			await eliminarDocumento(documento.id);
			notificar('Documento eliminado', 'exito');
			await goto('/documentos');
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo eliminar el documento', 'error');
		} finally {
			eliminando = false;
			mostrarConfirmarEliminar = false;
		}
	}
</script>

{#if cargando}
	<div class="h-64 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else if documento}
	{@const estado = estadoDocumento(documento.revisar, documento.motivoRevisar, documento.eliminadoEn)}
	<div class="mb-5 flex flex-wrap items-end justify-between gap-3">
		<div>
			<p class="eyebrow mb-1.5">
				<a href="/documentos" class="hover:text-(--texto-1)">Documentos</a> / Detalle
			</p>
			<h1 class="titulo-pagina">
				Documento <span class="dato-mono font-medium">{documento.consecutivo}</span>
			</h1>
		</div>
		<div class="flex gap-2">
			<Boton
				variante="secundario"
				deshabilitado={!tieneRol($rol, 'editor')}
				tooltipDeshabilitado="Necesitas rol editor"
				onclick={() => goto(`/documentos/${documento?.id}/editar`)}
			>
				Editar
			</Boton>
			<Boton
				variante="secundario"
				deshabilitado={!tieneRol($rol, 'editor') || !!documento.eliminadoEn}
				tooltipDeshabilitado={documento.eliminadoEn ? 'Ya está eliminado' : 'Necesitas rol editor'}
				onclick={() => goto(`/documentos/${documento?.id}/dividir`)}
			>
				Dividir PDF
			</Boton>
			<Boton
				variante="peligro"
				deshabilitado={!tieneRol($rol, 'admin') || !!documento.eliminadoEn}
				tooltipDeshabilitado={documento.eliminadoEn ? 'Ya está eliminado' : 'Necesitas rol admin'}
				onclick={() => (mostrarConfirmarEliminar = true)}
			>
				Eliminar
			</Boton>
		</div>
	</div>

	{#if documento.eliminadoEn}
		<div class="tarjeta mb-6 border-l-4 border-l-sello-500 p-4">
			<p class="font-medium text-sello-700 dark:text-[#e8988e]">
				Este documento fue eliminado el {formatoFecha(documento.eliminadoEn)}
			</p>
			<p class="mt-1 text-sm text-(--texto-2)">
				Es un soft delete: no aparece en las búsquedas normales, pero el PDF sigue disponible y la acción quedó
				auditada.
			</p>
		</div>
	{/if}

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<VisorPdf documentoId={documento.id} nombreArchivo="{documento.consecutivo}.pdf" />
		</div>
		<aside class="tarjeta flex h-fit flex-col gap-5 p-5">
			<div>
				<p class="eyebrow mb-1.5">Estado</p>
				<Badge tono={estado.tono} texto={estado.texto} titulo={estado.titulo} />
				{#if documento.revisar}
					<p class="mt-2 text-xs font-medium text-amber-700 dark:text-amber-400">
						{formatoMotivo(documento.motivoRevisar)}
					</p>
					<p class="mt-0.5 text-xs text-(--texto-3)">{descripcionMotivo(documento.motivoRevisar)}</p>
				{/if}
			</div>
			<div class="h-px bg-(--borde)" aria-hidden="true"></div>
			<div>
				<p class="eyebrow mb-1.5">Persona</p>
				{#if documento.persona}
					<a href="/personas/{documento.persona.id}" class="enlace-accion">
						{formatoTexto(documento.persona.nombre)}
						<span class="dato-mono text-(--texto-3)">({formatoTexto(documento.persona.cedula)})</span>
					</a>
				{:else}
					<p class="text-sm text-(--texto-3) italic">— sin dato —</p>
				{/if}
			</div>
			<div>
				<p class="eyebrow mb-1.5">Libro de origen</p>
				{#if documento.libro}
					<a href="/libros/{documento.libro.id}" class="enlace-accion break-all">
						{documento.libro.nombreArchivo}
					</a>
				{:else}
					<Badge tono="azul" texto="Carga manual" />
				{/if}
			</div>
			<div>
				<p class="eyebrow mb-1.5">Fecha</p>
				<p class="dato-mono text-sm text-(--texto-1)">{formatoFecha(documento.fecha)}</p>
			</div>
			<div>
				<p class="eyebrow mb-1.5">Procesado</p>
				<p class="dato-mono text-sm text-(--texto-1)">{formatoFecha(documento.procesadoEn)}</p>
			</div>
			{#if versiones.length > 1}
				<div class="h-px bg-(--borde)" aria-hidden="true"></div>
				<div>
					<p class="eyebrow mb-2">Versiones del PDF ({versiones.length})</p>
					<ul class="flex flex-col gap-2">
						{#each versiones as version (version.indice)}
							<li class="flex items-center justify-between gap-2 text-sm">
								<div class="min-w-0">
									<div class="flex items-center gap-1.5">
										{#if version.vigente}
											<Badge tono="verde" texto="vigente" />
										{:else}
											<span class="dato-mono text-xs text-(--texto-3)">v{versiones.length - version.indice}</span>
										{/if}
									</div>
									<p class="mt-0.5 truncate text-xs text-(--texto-3)">
										{formatoFecha(version.fecha)} · {version.usuario?.email ?? 'Proceso OCR'}
									</p>
								</div>
								<button
									class="enlace-accion shrink-0 text-xs"
									disabled={cargandoVersion === version.indice}
									onclick={() => verVersion(version.indice)}
								>
									{cargandoVersion === version.indice ? 'Abriendo…' : 'Ver'}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</aside>
	</div>

	<Modal
		abierto={mostrarConfirmarEliminar}
		titulo="Eliminar documento"
		confirmarTexto={eliminando ? 'Eliminando…' : 'Eliminar'}
		confirmarVariante="peligro"
		onconfirmar={confirmarEliminar}
		oncancelar={() => (mostrarConfirmarEliminar = false)}
	>
		Esto marca el documento <strong>{documento.consecutivo}</strong> como eliminado (soft delete). El PDF físico
		no se borra y la acción queda auditada. ¿Continuar?
	</Modal>
{/if}
