<script lang="ts">
	import type { Snippet } from 'svelte';
	import Boton from './Boton.svelte';

	interface Props {
		abierto: boolean;
		titulo: string;
		confirmarTexto?: string;
		confirmarVariante?: 'primario' | 'peligro';
		onconfirmar: () => void;
		oncancelar: () => void;
		children: Snippet;
	}

	let {
		abierto,
		titulo,
		confirmarTexto = 'Confirmar',
		confirmarVariante = 'primario',
		onconfirmar,
		oncancelar,
		children
	}: Props = $props();
</script>

<svelte:window
	onkeydown={(e) => {
		if (abierto && e.key === 'Escape') oncancelar();
	}}
/>

{#if abierto}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-tinta-950/60 p-4 backdrop-blur-[2px]">
		<div
			class="tarjeta animar-entrada w-full max-w-md p-6"
			role="alertdialog"
			aria-modal="true"
			aria-labelledby="modal-titulo"
		>
			<h2 id="modal-titulo" class="font-display text-lg font-semibold text-(--texto-1)">{titulo}</h2>
			<div class="mt-3 text-sm leading-relaxed text-(--texto-2)">
				{@render children()}
			</div>
			<div class="mt-6 flex justify-end gap-2">
				<Boton variante="secundario" onclick={oncancelar}>Cancelar</Boton>
				<Boton variante={confirmarVariante} onclick={onconfirmar}>{confirmarTexto}</Boton>
			</div>
		</div>
	</div>
{/if}
