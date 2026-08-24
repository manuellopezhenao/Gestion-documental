<script lang="ts">
	import { onMount } from 'svelte';
	import { salud, iniciarMonitoreoSalud } from '$lib/stores/salud';

	onMount(() => {
		iniciarMonitoreoSalud();
	});
</script>

{#if $salud && $salud.estado !== 'ok'}
	<div
		class="flex items-center gap-2 rounded-full border border-sello-100 bg-sello-50 px-3 py-1.5 text-sm font-medium text-sello-700 dark:border-sello-700/50 dark:bg-sello-700/20 dark:text-[#e8988e]"
	>
		<span
			class="h-2 w-2 shrink-0 rounded-full bg-sello-500"
			style="animation: brillo-pulso 1.6s ease-in-out infinite"
			aria-hidden="true"
		></span>
		Problema de conexión con la base de datos o el almacenamiento
	</div>
{/if}
