<script lang="ts">
	import { goto } from '$app/navigation';
	import { crearDocumentoManual } from '$lib/api/documentos';
	import { ApiError } from '$lib/api/apiFetch';
	import { esquemaDocumentoManual } from '$lib/schemas/documento';
	import { notificar } from '$lib/stores/toasts';
	import { descripcionMotivo } from '$lib/utils/motivoRevisar';
	import CampoFormulario from '$lib/components/CampoFormulario.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import { claseInput } from '$lib/components/estilos';
	import type { Documento } from '$lib/types/modelos';

	const TAMANO_MAXIMO = 50 * 1024 * 1024;

	let archivoInput = $state<HTMLInputElement | null>(null);
	let archivo = $state<File | null>(null);
	let consecutivo = $state('');
	let cedula = $state('');
	let nombre = $state('');
	let fecha = $state('');
	let errores = $state<Record<string, string>>({});
	let enviando = $state(false);
	let resultado = $state<Documento | null>(null);

	function limpiarFormulario(): void {
		consecutivo = '';
		cedula = '';
		nombre = '';
		fecha = '';
		archivo = null;
		errores = {};
		if (archivoInput) archivoInput.value = '';
	}

	function onArchivo(e: Event & { currentTarget: HTMLInputElement }): void {
		const seleccionado = e.currentTarget.files?.[0] ?? null;
		errores = { ...errores, archivo: '' };
		if (!seleccionado) {
			archivo = null;
			return;
		}
		if (seleccionado.type !== 'application/pdf') {
			errores = { ...errores, archivo: 'El archivo debe ser un PDF' };
			archivo = null;
			return;
		}
		if (seleccionado.size > TAMANO_MAXIMO) {
			errores = { ...errores, archivo: 'El archivo supera los 50MB' };
			archivo = null;
			return;
		}
		archivo = seleccionado;
	}

	async function enviar(evento: SubmitEvent): Promise<void> {
		evento.preventDefault();
		resultado = null;

		const validacion = esquemaDocumentoManual.safeParse({ consecutivo, cedula, nombre, fecha });
		const nuevosErrores: Record<string, string> = {};
		if (!validacion.success) {
			const campos = validacion.error.flatten().fieldErrors;
			for (const [campo, msgs] of Object.entries(campos)) {
				if (msgs?.[0]) nuevosErrores[campo] = msgs[0];
			}
		}
		if (!archivo) {
			nuevosErrores.archivo = 'Falta el archivo PDF';
		}
		errores = nuevosErrores;
		if (Object.keys(nuevosErrores).length > 0) return;

		enviando = true;
		try {
			resultado = await crearDocumentoManual({
				archivo: archivo!,
				consecutivo: consecutivo.trim(),
				cedula: cedula.trim() || undefined,
				nombre: nombre.trim() || undefined,
				fecha: fecha || undefined
			});
			notificar('Documento cargado correctamente', 'exito');
			limpiarFormulario();
		} catch (e) {
			if (e instanceof ApiError && Array.isArray(e.cuerpo.detalle)) {
				notificar(e.cuerpo.detalle.join(', '), 'error');
			} else {
				notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo cargar el documento', 'error');
			}
		} finally {
			enviando = false;
		}
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">
		<a href="/documentos" class="hover:text-(--texto-1)">Documentos</a> / Carga manual
	</p>
	<h1 class="titulo-pagina">Cargar documento manual</h1>
</div>

{#if resultado}
	<div
		class="tarjeta mb-6 max-w-xl border-l-4 p-5 {resultado.revisar ? 'border-l-amber-400' : 'border-l-emerald-500'}"
	>
		<p class="font-medium {resultado.revisar ? 'text-amber-700 dark:text-amber-300' : 'text-emerald-700 dark:text-emerald-300'}">
			Documento <span class="dato-mono">{resultado.consecutivo}</span> guardado
		</p>
		{#if resultado.revisar}
			<p class="mt-1 text-sm text-(--texto-2)">
				Quedó marcado para revisión: {descripcionMotivo(resultado.motivoRevisar)}
			</p>
		{/if}
		<div class="mt-3 flex gap-4">
			<a href="/documentos/{resultado.id}" class="enlace-accion">Ver documento</a>
			<a href="/documentos" class="enlace-accion">Ir a la lista</a>
			<button class="enlace-accion" onclick={() => (resultado = null)}>Cargar otro</button>
		</div>
	</div>
{/if}

<form onsubmit={enviar} class="tarjeta flex max-w-xl flex-col gap-4 p-6">
	<CampoFormulario etiqueta="Archivo PDF" para="archivo" obligatorio error={errores.archivo}>
		<input bind:this={archivoInput} id="archivo" type="file" accept="application/pdf" onchange={onArchivo} class={claseInput} />
	</CampoFormulario>
	<CampoFormulario etiqueta="Consecutivo" para="consecutivo" obligatorio error={errores.consecutivo}>
		<input id="consecutivo" bind:value={consecutivo} class="{claseInput} dato-mono" />
	</CampoFormulario>
	<CampoFormulario etiqueta="Cédula" para="cedula" error={errores.cedula}>
		<input id="cedula" bind:value={cedula} class="{claseInput} dato-mono" />
	</CampoFormulario>
	<CampoFormulario etiqueta="Nombre" para="nombre" error={errores.nombre}>
		<input id="nombre" bind:value={nombre} class={claseInput} />
	</CampoFormulario>
	<CampoFormulario etiqueta="Fecha" para="fecha" error={errores.fecha}>
		<input id="fecha" type="date" bind:value={fecha} class={claseInput} />
	</CampoFormulario>
	<div class="mt-2 flex gap-2">
		<Boton tipo="submit" deshabilitado={enviando}>{enviando ? 'Subiendo…' : 'Cargar documento'}</Boton>
		<Boton variante="secundario" onclick={() => goto('/documentos')}>Cancelar</Boton>
	</div>
</form>
