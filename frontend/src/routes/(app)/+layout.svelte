<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { token, usuario, rol, cerrarSesion } from '$lib/stores/sesion';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import BannerSalud from '$lib/components/BannerSalud.svelte';
	import Toaster from '$lib/components/Toaster.svelte';

	let { children } = $props();

	$effect(() => {
		if ($token === null) {
			void goto('/login');
		}
	});

	const iniciales = $derived(($usuario?.email ?? '?').slice(0, 2).toUpperCase());

	function salir(): void {
		cerrarSesion();
		void goto('/login');
	}
</script>

{#if $token}
	<div class="flex h-screen bg-(--fondo)">
		<Sidebar />
		<div class="flex flex-1 flex-col overflow-hidden">
			<header class="flex items-center justify-between gap-4 border-b border-(--borde) bg-(--superficie) px-6 py-2.5">
				<BannerSalud />
				<div class="ml-auto flex items-center gap-3">
					<span
						class="flex h-8 w-8 items-center justify-center rounded-full bg-tinta-100 font-mono text-[11px] font-medium text-tinta-800 dark:bg-tinta-800 dark:text-tinta-100"
						aria-hidden="true"
					>
						{iniciales}
					</span>
					<div class="hidden leading-tight sm:block">
						<p class="text-sm text-(--texto-2)">{$usuario?.email}</p>
						<p class="font-mono text-[10px] tracking-[0.14em] text-(--texto-3) uppercase">{$rol}</p>
					</div>
					<span class="mx-1 h-6 w-px bg-(--borde)" aria-hidden="true"></span>
					<button
						class="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-(--texto-3) transition-colors hover:bg-(--superficie-2) hover:text-(--texto-1)"
						onclick={salir}
					>
						<svg
							viewBox="0 0 24 24"
							class="h-4 w-4"
							fill="none"
							stroke="currentColor"
							stroke-width="2"
							stroke-linecap="round"
							stroke-linejoin="round"
							aria-hidden="true"
						>
							<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
							<polyline points="16 17 21 12 16 7" />
							<line x1="21" x2="9" y1="12" y2="12" />
						</svg>
						Salir
					</button>
				</div>
			</header>
			<main class="flex-1 overflow-y-auto">
				{#key page.url.pathname}
					<div class="animar-entrada mx-auto w-full max-w-6xl p-6 lg:p-8">
						{@render children()}
					</div>
				{/key}
			</main>
		</div>
	</div>
	<Toaster />
{/if}
