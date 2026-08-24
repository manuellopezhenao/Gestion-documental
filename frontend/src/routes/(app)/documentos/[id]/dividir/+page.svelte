<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { detalleDocumento, archivoDocumento, dividirDocumento } from '$lib/api/documentos';
	import { cargarPdf, renderizarPaginaComoImagen } from '$lib/utils/pdfPaginas';
	import { ApiError } from '$lib/api/apiFetch';
	import { notificar } from '$lib/stores/toasts';
	import { tieneRol, rol } from '$lib/stores/sesion';
	import type { DocumentoConRelaciones } from '$lib/types/modelos';
	import CampoFormulario from '$lib/components/CampoFormulario.svelte';
	import Boton from '$lib/components/Boton.svelte';
	import { claseInput } from '$lib/components/estilos';

	const id = $derived(Number(page.params.id));

	const PALETA = [
		{ borde: 'border-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40', texto: 'text-violet-700 dark:text-violet-300', punto: 'bg-violet-500', cinta: 'bg-violet-500' },
		{ borde: 'border-sky-400', bg: 'bg-sky-50 dark:bg-sky-950/40', texto: 'text-sky-700 dark:text-sky-300', punto: 'bg-sky-500', cinta: 'bg-sky-500' },
		{ borde: 'border-fuchsia-400', bg: 'bg-fuchsia-50 dark:bg-fuchsia-950/40', texto: 'text-fuchsia-700 dark:text-fuchsia-300', punto: 'bg-fuchsia-500', cinta: 'bg-fuchsia-500' },
		{ borde: 'border-orange-400', bg: 'bg-orange-50 dark:bg-orange-950/40', texto: 'text-orange-700 dark:text-orange-300', punto: 'bg-orange-500', cinta: 'bg-orange-500' },
		{ borde: 'border-teal-400', bg: 'bg-teal-50 dark:bg-teal-950/40', texto: 'text-teal-700 dark:text-teal-300', punto: 'bg-teal-500', cinta: 'bg-teal-500' },
		{ borde: 'border-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/40', texto: 'text-indigo-700 dark:text-indigo-300', punto: 'bg-indigo-500', cinta: 'bg-indigo-500' }
	];

	interface DatosParte {
		consecutivo: string;
		cedula: string;
		nombre: string;
		fecha: string;
	}

	let documento = $state<DocumentoConRelaciones | null>(null);
	let cargando = $state(true);
	let cargandoError = $state<string | null>(null);
	let miniaturas = $state<string[]>([]);
	let numPaginas = $state(0);
	let cortes = $state<Set<number>>(new Set());
	let datosPorInicio = $state<Record<number, DatosParte>>({});
	let erroresPartes = $state<Record<number, string>>({});
	let enviando = $state(false);

	async function cargar(docId: number): Promise<void> {
		cargando = true;
		cargandoError = null;
		try {
			documento = await detalleDocumento(docId);
			if (documento.eliminadoEn) {
				cargandoError = 'Este documento ya está eliminado, no se puede dividir';
				return;
			}
			const blob = await archivoDocumento(docId, 'inline');
			const bytes = await blob.arrayBuffer();
			const pdf = await cargarPdf(bytes);
			numPaginas = pdf.numPages;
			miniaturas = await Promise.all(
				Array.from({ length: numPaginas }, (_, i) => renderizarPaginaComoImagen(pdf, i + 1, 170))
			);
		} catch {
			cargandoError = 'No se pudo cargar el PDF para dividirlo';
		} finally {
			cargando = false;
		}
	}

	$effect(() => {
		if (!tieneRol($rol, 'editor')) {
			void goto(`/documentos/${id}`);
		}
	});

	$effect(() => {
		void cargar(id);
	});

	const grupos = $derived.by(() => {
		const limites = [0, ...[...cortes].sort((a, b) => a - b), numPaginas];
		const out: { inicio: number; fin: number }[] = [];
		for (let i = 0; i < limites.length - 1; i++) {
			if (limites[i] < limites[i + 1]) out.push({ inicio: limites[i] + 1, fin: limites[i + 1] });
		}
		return out;
	});

	function indiceGrupoDePagina(pagina: number): number {
		return grupos.findIndex((g) => pagina >= g.inicio && pagina <= g.fin);
	}

	function colorDe(indice: number) {
		return PALETA[indice % PALETA.length];
	}

	$effect(() => {
		const inicios = new Set(grupos.map((g) => g.inicio));
		for (const g of grupos) {
			if (!datosPorInicio[g.inicio]) {
				datosPorInicio[g.inicio] = {
					consecutivo: g.inicio === 1 ? (documento?.consecutivo ?? '') : '',
					cedula: documento?.persona?.cedula ?? '',
					nombre: documento?.persona?.nombre ?? '',
					fecha: documento?.fecha?.slice(0, 10) ?? ''
				};
			}
		}
		for (const clave of Object.keys(datosPorInicio)) {
			if (!inicios.has(Number(clave))) delete datosPorInicio[Number(clave)];
		}
	});

	function toggleCorte(despuesDePagina: number): void {
		const nuevo = new Set(cortes);
		if (nuevo.has(despuesDePagina)) nuevo.delete(despuesDePagina);
		else nuevo.add(despuesDePagina);
		cortes = nuevo;
	}

	async function enviar(): Promise<void> {
		if (!documento) return;
		if (grupos.length < 2) {
			notificar('Marcá al menos un corte para dividir el documento', 'error');
			return;
		}

		const nuevosErrores: Record<number, string> = {};
		const vistos = new Set<string>();
		for (const g of grupos) {
			const consecutivo = datosPorInicio[g.inicio]?.consecutivo?.trim() ?? '';
			if (!consecutivo) {
				nuevosErrores[g.inicio] = 'Falta el consecutivo';
			} else if (vistos.has(consecutivo)) {
				nuevosErrores[g.inicio] = 'Consecutivo repetido entre las partes';
			}
			vistos.add(consecutivo);
		}
		erroresPartes = nuevosErrores;
		if (Object.keys(nuevosErrores).length > 0) return;

		enviando = true;
		try {
			const partes = grupos.map((g) => {
				const datos = datosPorInicio[g.inicio];
				return {
					pagina_inicio: g.inicio,
					pagina_fin: g.fin,
					consecutivo: datos.consecutivo.trim(),
					cedula: datos.cedula.trim() || undefined,
					nombre: datos.nombre.trim() || undefined,
					fecha: datos.fecha || undefined
				};
			});
			await dividirDocumento(documento.id, partes);
			notificar(`Documento dividido en ${partes.length} documentos`, 'exito');
			await goto(documento.libro ? `/libros/${documento.libro.id}` : '/documentos');
		} catch (e) {
			notificar(e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo dividir el documento', 'error');
		} finally {
			enviando = false;
		}
	}
</script>

<div class="mb-6">
	<p class="eyebrow mb-1.5">
		<a href="/documentos/{id}" class="hover:text-(--texto-1)">Documentos</a> / Dividir
	</p>
	<h1 class="titulo-pagina">Dividir documento {documento?.consecutivo ?? ''}</h1>
	<p class="mt-1.5 max-w-2xl text-sm text-(--texto-2)">
		Hacé clic en <span class="dato-mono text-xs text-(--texto-1)">+ Dividir aquí</span> sobre la página donde empieza cada
		documento nuevo. El PDF original se conserva en el archivo; cada parte se guarda como un documento propio.
	</p>
</div>

{#if cargando}
	<div class="flex flex-col gap-4">
		<div class="h-56 animate-pulse rounded-xl bg-(--superficie-3)"></div>
		<p class="text-center text-sm text-(--texto-3)">Cargando páginas del PDF…</p>
	</div>
{:else if cargandoError}
	<p class="text-sm font-medium text-sello-600">{cargandoError}</p>
{:else if documento}
	<div class="tarjeta mb-8 p-5">
		<div class="flex flex-wrap gap-3">
			{#each Array(numPaginas) as _, indice (indice)}
				{@const pagina = indice + 1}
				{@const grupo = indiceGrupoDePagina(pagina)}
				{@const color = colorDe(grupo)}
				{@const esInicio = grupos[grupo]?.inicio === pagina}
				<div class="flex w-[150px] flex-col gap-1.5">
					{#if pagina === 1}
						<span class="truncate rounded-md px-2 py-1 text-center font-mono text-[11px] font-medium text-white {color.cinta}">
							Documento 1
						</span>
					{:else}
						<button
							type="button"
							onclick={() => toggleCorte(pagina - 1)}
							class="truncate rounded-md px-2 py-1 text-center font-mono text-[11px] font-medium transition-colors {esInicio
								? `text-white ${color.cinta}`
								: 'border border-dashed border-(--borde-fuerte) text-(--texto-3) hover:border-(--texto-2) hover:text-(--texto-1)'}"
						>
							{esInicio ? `Documento ${grupo + 1}` : '+ Dividir aquí'}
						</button>
					{/if}
					<div class="relative overflow-hidden rounded-lg border-2 {color.borde} bg-white shadow-sm">
						{#if miniaturas[indice]}
							<img src={miniaturas[indice]} alt="Página {pagina}" class="w-full" />
						{/if}
						<span class="absolute right-1 bottom-1 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[10px] text-white">
							{pagina}
						</span>
					</div>
				</div>
			{/each}
		</div>
	</div>

	<p class="eyebrow mb-3">Documentos resultantes ({grupos.length})</p>
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
		{#each grupos as grupo, indice (grupo.inicio)}
			{@const color = colorDe(indice)}
			{@const datos = datosPorInicio[grupo.inicio]}
			<div class="tarjeta border-t-4 {color.borde} p-4">
				<div class="mb-3 flex items-center justify-between">
					<span class="inline-flex items-center gap-1.5 font-mono text-xs font-medium {color.texto}">
						<span class="h-2 w-2 rounded-full {color.punto}"></span>
						Documento {indice + 1}
					</span>
					<span class="dato-mono text-xs text-(--texto-3)">
						{grupo.inicio === grupo.fin ? `Página ${grupo.inicio}` : `Páginas ${grupo.inicio}–${grupo.fin}`}
					</span>
				</div>
				{#if datos}
					<div class="flex flex-col gap-3">
						<CampoFormulario etiqueta="Consecutivo" para="consecutivo-{grupo.inicio}" obligatorio error={erroresPartes[grupo.inicio]}>
							<input id="consecutivo-{grupo.inicio}" bind:value={datos.consecutivo} class="{claseInput} dato-mono" />
						</CampoFormulario>
						<CampoFormulario etiqueta="Cédula" para="cedula-{grupo.inicio}">
							<input id="cedula-{grupo.inicio}" bind:value={datos.cedula} class="{claseInput} dato-mono" />
						</CampoFormulario>
						<CampoFormulario etiqueta="Nombre" para="nombre-{grupo.inicio}">
							<input id="nombre-{grupo.inicio}" bind:value={datos.nombre} class={claseInput} />
						</CampoFormulario>
						<CampoFormulario etiqueta="Fecha" para="fecha-{grupo.inicio}">
							<input id="fecha-{grupo.inicio}" type="date" bind:value={datos.fecha} class={claseInput} />
						</CampoFormulario>
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<div class="mt-6 flex items-center gap-3">
		<Boton deshabilitado={enviando || grupos.length < 2} onclick={enviar}>
			{enviando ? 'Dividiendo…' : `Dividir en ${grupos.length} documentos`}
		</Boton>
		<Boton variante="secundario" onclick={() => goto(`/documentos/${id}`)}>Cancelar</Boton>
		{#if grupos.length < 2}
			<p class="text-xs text-(--texto-3)">Marcá al menos un corte arriba para habilitar la división.</p>
		{/if}
	</div>
{/if}
