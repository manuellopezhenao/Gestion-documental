<script lang="ts">
	import { toasts } from '$lib/stores/toasts';

	const acento: Record<string, string> = {
		exito: 'border-l-emerald-500',
		error: 'border-l-sello-500',
		info: 'border-l-tinta-400'
	};

	const iconos: Record<string, string> = {
		exito: '<path d="M20 6 9 17l-5-5"/>',
		error: '<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>',
		info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
	};
</script>

<div class="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2">
	{#each $toasts as toast (toast.id)}
		<div
			class="animar-entrada pointer-events-auto flex items-center gap-2.5 rounded-lg border-l-4 bg-tinta-950 px-4 py-2.5 text-sm text-papel-50 shadow-lg {acento[
				toast.tipo
			]}"
			role="status"
		>
			<svg
				viewBox="0 0 24 24"
				class="h-4 w-4 shrink-0 opacity-80"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
				aria-hidden="true"
			>
				{@html iconos[toast.tipo]}
			</svg>
			{toast.mensaje}
		</div>
	{/each}
</div>
