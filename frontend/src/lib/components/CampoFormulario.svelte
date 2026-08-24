<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		etiqueta: string;
		para: string;
		error?: string | null;
		obligatorio?: boolean;
		children: Snippet;
	}
	let { etiqueta, para, error = null, obligatorio = false, children }: Props = $props();
</script>

<div class="flex flex-col gap-1.5">
	<label for={para} class="text-sm font-medium text-(--texto-2)">
		{etiqueta}{#if obligatorio}<span class="text-sello-500"> *</span>{/if}
	</label>
	{@render children()}
	{#if error}
		<p class="text-xs font-medium text-sello-600 dark:text-sello-500">{error}</p>
	{/if}
</div>
