<script lang="ts">
	import { obtenerResumen } from '$lib/api/reportes';
	import type { ReporteResumen } from '$lib/types/modelos';

	let resumen = $state<ReporteResumen | null>(null);
	let cargando = $state(true);
	let error = $state<string | null>(null);

	$effect(() => {
		cargando = true;
		obtenerResumen()
			.then((r) => (resumen = r))
			.catch(() => (error = 'No se pudo cargar el resumen'))
			.finally(() => (cargando = false));
	});

	const hoy = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

	const tarjetas = $derived(
		resumen
			? [
					{
						etiqueta: 'Documentos totales',
						valor: resumen.total_documentos,
						href: '/documentos',
						icono:
							'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/>'
					},
					{
						etiqueta: 'Pendientes de revisar',
						valor: resumen.pendientes_revisar,
						resaltar: resumen.pendientes_revisar > 0,
						href: '/revision',
						icono:
							'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'
					},
					{
						etiqueta: 'Personas sin cédula',
						valor: resumen.personas_sin_cedula,
						href: '/personas',
						icono:
							'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/>'
					},
					{
						etiqueta: 'Libros con error',
						valor: resumen.libros_con_errores,
						resaltar: resumen.libros_con_errores > 0,
						href: '/libros',
						icono: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="m9 9.5 6 6"/><path d="m15 9.5-6 6"/>'
					}
				]
			: []
	);

	const maximoMes = $derived(resumen ? Math.max(1, ...resumen.documentos_por_mes.map((f) => f.total)) : 1);
</script>

<div class="mb-8">
	<p class="eyebrow mb-1.5">Resumen del archivo</p>
	<div class="flex flex-wrap items-baseline justify-between gap-2">
		<h1 class="titulo-pagina">Panel</h1>
		<p class="dato-mono text-xs text-(--texto-3)">{hoy}</p>
	</div>
</div>

{#if cargando}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each Array(4) as _}
			<div class="h-28 animate-pulse rounded-xl bg-(--superficie-3)"></div>
		{/each}
	</div>
{:else if error}
	<p class="text-sm font-medium text-sello-600">{error}</p>
{:else}
	<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
		{#each tarjetas as tarjeta (tarjeta.etiqueta)}
			<a
				href={tarjeta.href}
				class="tarjeta group relative overflow-hidden p-5 transition-shadow duration-150 hover:shadow-md {tarjeta.resaltar
					? 'border-l-4 border-l-amber-400'
					: ''}"
			>
				<div class="flex items-start justify-between gap-2">
					<p class="text-sm text-(--texto-3)">{tarjeta.etiqueta}</p>
					<svg
						viewBox="0 0 24 24"
						class="h-[18px] w-[18px] shrink-0 text-(--texto-3) opacity-50 transition-opacity group-hover:opacity-90"
						fill="none"
						stroke="currentColor"
						stroke-width="1.8"
						stroke-linecap="round"
						stroke-linejoin="round"
						aria-hidden="true"
					>
						{@html tarjeta.icono}
					</svg>
				</div>
				<p
					class="dato-mono mt-2 text-3xl font-medium {tarjeta.resaltar
						? 'text-amber-600 dark:text-amber-400'
						: 'text-(--texto-1)'}"
				>
					{tarjeta.valor.toLocaleString()}
				</p>
				<p class="mt-2 text-xs text-(--texto-3) opacity-0 transition-opacity duration-150 group-hover:opacity-100">
					Ver detalle →
				</p>
			</a>
		{/each}
	</div>

	{#if resumen && resumen.documentos_por_mes.length > 0}
		<div class="tarjeta mt-6 p-6">
			<p class="eyebrow mb-4">Documentos por mes</p>
			<div class="flex flex-col gap-2.5">
				{#each resumen.documentos_por_mes as fila (fila.mes)}
					<div class="flex items-center gap-3">
						<span class="dato-mono w-16 shrink-0 text-xs text-(--texto-3)">{fila.mes}</span>
						<div class="h-2 flex-1 overflow-hidden rounded-full bg-(--superficie-3)">
							<div
								class="h-full rounded-full bg-tinta-600 dark:bg-tinta-300"
								style="width: {Math.max(2, (fila.total / maximoMes) * 100)}%"
							></div>
						</div>
						<span class="dato-mono w-12 shrink-0 text-right text-xs font-medium text-(--texto-1)">
							{fila.total.toLocaleString()}
						</span>
					</div>
				{/each}
			</div>
		</div>
	{/if}
{/if}
