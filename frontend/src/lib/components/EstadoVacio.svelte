<script lang="ts">
	import type { Snippet } from 'svelte';
	interface Props {
		titulo: string;
		descripcion?: string;
		accion?: Snippet;
	}
	let { titulo, descripcion, accion }: Props = $props();
</script>

<div
	class="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-(--borde-fuerte) bg-(--superficie-2) py-16 text-center"
>
	<svg
		viewBox="0 0 24 24"
		class="mb-1 h-8 w-8 text-(--texto-3) opacity-60"
		fill="none"
		stroke="currentColor"
		stroke-width="1.5"
		stroke-linecap="round"
		stroke-linejoin="round"
		aria-hidden="true"
	>
		<path d="M22 12h-6l-2 3h-4l-2-3H2" />
		<path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
	</svg>
	<p class="text-sm font-medium text-(--texto-2)">{titulo}</p>
	{#if descripcion}
		<p class="max-w-sm text-sm text-(--texto-3)">{descripcion}</p>
	{/if}
	{#if accion}
		<div class="mt-2">{@render accion()}</div>
	{/if}
</div>
