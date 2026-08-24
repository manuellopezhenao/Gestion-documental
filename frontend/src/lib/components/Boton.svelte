<script lang="ts">
	import type { Snippet } from 'svelte';

	interface Props {
		variante?: 'primario' | 'secundario' | 'peligro';
		tipo?: 'button' | 'submit';
		deshabilitado?: boolean;
		tooltipDeshabilitado?: string;
		onclick?: () => void;
		children: Snippet;
	}

	let {
		variante = 'primario',
		tipo = 'button',
		deshabilitado = false,
		tooltipDeshabilitado,
		onclick,
		children
	}: Props = $props();

	const clasesPorVariante: Record<string, string> = {
		primario: 'btn-primario',
		secundario: 'btn-secundario',
		peligro: 'btn-peligro'
	};
</script>

<button
	type={tipo}
	{onclick}
	disabled={deshabilitado}
	title={deshabilitado ? tooltipDeshabilitado : undefined}
	class="btn {clasesPorVariante[variante]}"
>
	{@render children()}
</button>
