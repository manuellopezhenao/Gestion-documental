<script lang="ts">
	import { page } from '$app/state';
	import { tieneRol, rol } from '$lib/stores/sesion';

	// Trazos estilo lucide (24x24, stroke)
	const itemsBase = [
		{
			href: '/',
			etiqueta: 'Panel',
			icono:
				'<rect width="7" height="9" x="3" y="3" rx="1"/><rect width="7" height="5" x="14" y="3" rx="1"/><rect width="7" height="9" x="14" y="12" rx="1"/><rect width="7" height="5" x="3" y="16" rx="1"/>'
		},
		{
			href: '/documentos',
			etiqueta: 'Documentos',
			icono:
				'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>'
		},
		{
			href: '/revision',
			etiqueta: 'Revisión',
			icono:
				'<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>'
		},
		{
			href: '/consecutivos',
			etiqueta: 'Consecutivos',
			icono:
				'<line x1="4" x2="20" y1="9" y2="9"/><line x1="4" x2="20" y1="15" y2="15"/><line x1="10" x2="8" y1="3" y2="21"/><line x1="16" x2="14" y1="3" y2="21"/>'
		},
		{
			href: '/personas',
			etiqueta: 'Personas',
			icono:
				'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'
		},
		{
			href: '/libros',
			etiqueta: 'Libros',
			icono:
				'<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/><path d="M8 7h8"/><path d="M8 11h6"/>'
		},
		{
			href: '/auditoria',
			etiqueta: 'Auditoría',
			icono:
				'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/><path d="m9 12 2 2 4-4"/>',
			minimo: 'admin' as const
		},
		{
			href: '/sistema',
			etiqueta: 'Sistema',
			icono:
				'<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>',
			minimo: 'admin' as const
		}
	];

	const items = $derived(itemsBase.filter((item) => !item.minimo || tieneRol($rol, item.minimo)));

	function activo(href: string): boolean {
		return href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);
	}
</script>

<nav class="flex w-16 shrink-0 flex-col bg-tinta-950 text-tinta-200 lg:w-60">
	<div class="flex items-center justify-center gap-3 px-2 pt-6 pb-7 lg:justify-start lg:px-5">
		<!-- Sello de la casa -->
		<svg viewBox="0 0 40 40" class="h-10 w-10 shrink-0" aria-hidden="true">
			<circle cx="20" cy="20" r="18.5" fill="none" stroke="var(--color-cinta-400)" stroke-width="1.4" />
			<circle cx="20" cy="20" r="14.5" fill="none" stroke="var(--color-cinta-400)" stroke-width="0.8" opacity="0.7" />
			<text
				x="20"
				y="25.5"
				text-anchor="middle"
				font-family="IBM Plex Serif, Georgia, serif"
				font-size="13.5"
				font-weight="600"
				fill="var(--color-cinta-300)">GD</text>
		</svg>
		<div class="hidden min-w-0 lg:block">
			<p class="font-display text-[15px] leading-tight font-semibold text-papel-50">Gestión documental</p>
			<p class="mt-0.5 font-mono text-[10px] tracking-[0.18em] text-tinta-400 uppercase">Archivo digital</p>
		</div>
	</div>

	<div class="flex flex-1 flex-col gap-1 px-2 lg:px-3">
		{#each items as item (item.href)}
			{@const esActivo = activo(item.href)}
			<a
				href={item.href}
				aria-current={esActivo ? 'page' : undefined}
				title={item.etiqueta}
				class="relative flex items-center justify-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-100 lg:justify-start {esActivo
					? 'bg-tinta-800/70 text-papel-50'
					: 'text-tinta-300 hover:bg-tinta-900 hover:text-papel-100'}"
			>
				{#if esActivo}
					<!-- Cinta que marca la página abierta del libro -->
					<span class="absolute top-1.5 bottom-1.5 -left-2 w-[3px] rounded-r bg-cinta-400 lg:-left-3" aria-hidden="true"></span>
				{/if}
				<svg
					viewBox="0 0 24 24"
					class="h-[18px] w-[18px] shrink-0 {esActivo ? 'text-cinta-300' : 'text-tinta-400'}"
					fill="none"
					stroke="currentColor"
					stroke-width="1.8"
					stroke-linecap="round"
					stroke-linejoin="round"
					aria-hidden="true"
				>
					{@html item.icono}
				</svg>
				<span class="hidden lg:inline">{item.etiqueta}</span>
			</a>
		{/each}
	</div>

	<p class="hidden px-5 pb-5 font-mono text-[10px] tracking-[0.14em] text-tinta-500 uppercase lg:block">
		Registro · Consulta · Revisión
	</p>
</nav>
