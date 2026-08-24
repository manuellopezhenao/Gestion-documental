<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { detalleDocumento, actualizarDocumento, type ActualizarDocumentoPayload } from '$lib/api/documentos';
	import { buscarPersonas } from '$lib/api/personas';
	import { ApiError } from '$lib/api/apiFetch';
	import { esquemaDocumentoEditar } from '$lib/schemas/documento';
	import { notificar } from '$lib/stores/toasts';
	import type { DocumentoConRelaciones, Persona } from '$lib/types/modelos';
	import CampoFormulario from '$lib/components/CampoFormulario.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import VisorPdf from '$lib/components/VisorPdf.svelte';
	import { claseInput } from '$lib/components/estilos';
	import { formatoMotivo, descripcionMotivo } from '$lib/utils/motivoRevisar';

	const TAMANO_MAXIMO = 50 * 1024 * 1024;

	const id = $derived(Number(page.params.id));

	let documento = $state<DocumentoConRelaciones | null>(null);
	let cargando = $state(true);
	let cargandoError = $state<string | null>(null);

	let consecutivo = $state('');
	let cedula = $state('');
	let nombre = $state('');
	let fecha = $state('');
	let archivoNuevo = $state<File | null>(null);
	let errores = $state<Record<string, string>>({});
	let enviando = $state(false);

	function onArchivo(e: Event & { currentTarget: HTMLInputElement }): void {
		const seleccionado = e.currentTarget.files?.[0] ?? null;
		errores = { ...errores, archivo: '' };
		if (!seleccionado) {
			archivoNuevo = null;
			return;
		}
		if (seleccionado.type !== 'application/pdf') {
			errores = { ...errores, archivo: 'El archivo debe ser un PDF' };
			archivoNuevo = null;
			return;
		}
		if (seleccionado.size > TAMANO_MAXIMO) {
			errores = { ...errores, archivo: 'El archivo supera los 50MB' };
			archivoNuevo = null;
			return;
		}
		archivoNuevo = seleccionado;
	}

	let personaCoincidente = $state<Persona | null>(null);
	let temporizadorCedula: ReturnType<typeof setTimeout> | undefined;

	async function cargar(docId: number): Promise<void> {
		cargando = true;
		cargandoError = null;
		try {
			documento = await detalleDocumento(docId);
			consecutivo = documento.consecutivo;
			cedula = documento.persona?.cedula ?? '';
			nombre = documento.persona?.nombre ?? '';
			fecha = documento.fecha?.slice(0, 10) ?? '';
		} catch {
			cargandoError = 'No se pudo cargar el documento';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		void cargar(id);
	});

	function onCedula(valor: string): void {
		cedula = valor;
		personaCoincidente = null;
		clearTimeout(temporizadorCedula);
		if (!valor || valor === documento?.persona?.cedula) return;
		temporizadorCedula = setTimeout(async () => {
			try {
				const resultado = await buscarPersonas(valor, 1, 5);
				personaCoincidente = resultado.resultados.find((p) => p.cedula === valor) ?? null;
			} catch {
				// busqueda auxiliar: si falla, simplemente no se muestra el aviso
			}
		}, 300);
	}

	async function enviar(evento: SubmitEvent): Promise<void> {
		evento.preventDefault();
		if (!documento) return;
		if (errores.archivo) return;

		const validacion = esquemaDocumentoEditar.safeParse({ consecutivo, cedula, nombre, fecha });
		if (!validacion.success) {
			const campos = validacion.error.flatten().fieldErrors;
			errores = Object.fromEntries(Object.entries(campos).map(([campo, msgs]) => [campo, msgs?.[0] ?? '']));
			return;
		}
		errores = {};

		const payload: ActualizarDocumentoPayload = {};
		if (consecutivo.trim() && consecutivo.trim() !== documento.consecutivo) payload.consecutivo = consecutivo.trim();
		if (cedula.trim() && cedula.trim() !== (documento.persona?.cedula ?? '')) payload.cedula = cedula.trim();
		if (nombre.trim() && nombre.trim() !== (documento.persona?.nombre ?? '')) payload.nombre = nombre.trim();
		if (fecha && fecha !== (documento.fecha?.slice(0, 10) ?? '')) payload.fecha = fecha;
		if (archivoNuevo) payload.archivo = archivoNuevo;

		if (Object.keys(payload).length === 0) {
			await goto(`/documentos/${documento.id}`);
			return;
		}

		enviando = true;
		try {
			await actualizarDocumento(documento.id, payload);
			notificar('Documento corregido', 'exito');
			await goto(`/documentos/${documento.id}`);
		} catch (e) {
			if (e instanceof ApiError && Array.isArray(e.cuerpo.detalle)) {
				errores = { general: e.cuerpo.detalle.join(', ') };
			} else {
				notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo corregir el documento', 'error');
			}
		} finally {
			enviando = false;
		}
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">
		<a href="/documentos" class="hover:text-(--texto-1)">Documentos</a> / Corrección
	</p>
	<h1 class="titulo-pagina">Corregir documento</h1>
</div>

{#if cargando}
	<div class="h-96 animate-pulse rounded-xl bg-(--superficie-3)"></div>
{:else if cargandoError}
	<p class="text-sm font-medium text-sello-600">{cargandoError}</p>
{:else if documento}
	<div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
		<div class="lg:col-span-2">
			<VisorPdf documentoId={documento.id} nombreArchivo="{documento.consecutivo}.pdf" />
		</div>
		<form onsubmit={enviar} class="tarjeta flex h-fit flex-col gap-4 p-5">
			{#if documento.revisar}
				<div class="rounded-lg border-l-4 border-l-amber-400 bg-amber-50 p-3 dark:bg-amber-900/20">
					<p class="text-sm font-medium text-amber-800 dark:text-amber-300">
						Pendiente de revisión: {formatoMotivo(documento.motivoRevisar)}
					</p>
					<p class="mt-1 text-xs text-amber-700 dark:text-amber-400">{descripcionMotivo(documento.motivoRevisar)}</p>
				</div>
			{/if}
			<CampoFormulario etiqueta="Consecutivo" para="consecutivo" error={errores.consecutivo}>
				<input id="consecutivo" bind:value={consecutivo} class="{claseInput} dato-mono" />
			</CampoFormulario>
			<CampoFormulario etiqueta="Cédula" para="cedula" error={errores.cedula}>
				<input id="cedula" value={cedula} oninput={(e) => onCedula(e.currentTarget.value)} class="{claseInput} dato-mono" />
			</CampoFormulario>
			{#if personaCoincidente}
				<p class="-mt-2 text-xs text-amber-700 dark:text-amber-400">
					Esta cédula ya pertenece a <strong>{personaCoincidente.nombre ?? 'sin nombre'}</strong> — este documento se va
					a vincular a esa persona en vez de crear una nueva.
				</p>
			{/if}
			<CampoFormulario etiqueta="Nombre" para="nombre" error={errores.nombre}>
				<input id="nombre" bind:value={nombre} class={claseInput} />
			</CampoFormulario>
			<CampoFormulario etiqueta="Fecha" para="fecha" error={errores.fecha}>
				<input id="fecha" type="date" bind:value={fecha} class={claseInput} />
			</CampoFormulario>
			<CampoFormulario etiqueta="Reemplazar PDF" para="archivo" error={errores.archivo}>
				<input id="archivo" type="file" accept="application/pdf" onchange={onArchivo} class={claseInput} />
				{#if archivoNuevo}
					<p class="mt-1 text-xs text-amber-700 dark:text-amber-400">
						Se va a reemplazar el archivo actual por <strong>{archivoNuevo.name}</strong> al guardar.
					</p>
				{:else}
					<p class="mt-1 text-xs text-(--texto-3)">Opcional — dejá vacío para conservar el PDF actual.</p>
				{/if}
			</CampoFormulario>
			{#if errores.general}<p class="text-sm font-medium text-sello-600">{errores.general}</p>{/if}
			<div class="mt-2 flex gap-2">
				<Boton tipo="submit" deshabilitado={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</Boton>
				<Boton variante="secundario" onclick={() => goto(`/documentos/${documento?.id}`)}>Cancelar</Boton>
			</div>
		</form>
	</div>
{/if}
