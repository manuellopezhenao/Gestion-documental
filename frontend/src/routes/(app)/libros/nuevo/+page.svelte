<script lang="ts">
	import { goto } from '$app/navigation';
	import { subirLibro } from '$lib/api/libros';
	import { ApiError } from '$lib/api/apiFetch';
	import { notificar } from '$lib/stores/toasts';
	import Boton from '$lib/components/Boton.svelte';
	import { claseInput } from '$lib/components/estilos';

	let archivo = $state<File | null>(null);
	let error = $state<string | null>(null);
	let subiendo = $state(false);

	function onArchivo(e: Event & { currentTarget: HTMLInputElement }): void {
		const seleccionado = e.currentTarget.files?.[0] ?? null;
		if (seleccionado && seleccionado.type !== 'application/pdf') {
			error = 'El archivo debe ser un PDF';
			archivo = null;
			return;
		}
		error = null;
		archivo = seleccionado;
	}

	async function enviar(evento: SubmitEvent): Promise<void> {
		evento.preventDefault();
		if (!archivo) {
			error = 'Falta el archivo PDF';
			return;
		}
		subiendo = true;
		try {
			const libro = await subirLibro(archivo);
			notificar('Libro cargado — el procesamiento sigue en el servidor', 'exito');
			await goto(`/libros/${libro.id}`);
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo subir el libro', 'error');
		} finally {
			subiendo = false;
		}
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">
		<a href="/libros" class="hover:text-(--texto-1)">Libros</a> / Nuevo
	</p>
	<h1 class="titulo-pagina">Subir libro</h1>
	<p class="mt-2 max-w-lg text-sm leading-relaxed text-(--texto-3)">
		El OCR de un libro grande puede tardar minutos u horas. Una vez subido, el proceso sigue corriendo en el servidor
		— puedes cerrar esta pestaña y volver más tarde a ver el progreso.
	</p>
</div>

<form onsubmit={enviar} class="tarjeta flex max-w-lg flex-col gap-4 p-6">
	<input type="file" accept="application/pdf" onchange={onArchivo} class={claseInput} aria-label="Archivo PDF del libro" />
	{#if error}<p class="text-sm font-medium text-sello-600">{error}</p>{/if}
	<div class="mt-2 flex gap-2">
		<Boton tipo="submit" deshabilitado={subiendo}>{subiendo ? 'Subiendo…' : 'Subir libro'}</Boton>
		<Boton variante="secundario" onclick={() => goto('/libros')}>Cancelar</Boton>
	</div>
</form>
