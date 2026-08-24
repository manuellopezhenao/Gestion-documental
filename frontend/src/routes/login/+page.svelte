<script lang="ts">
	import { goto } from '$app/navigation';
	import { login as apiLogin } from '$lib/api/auth';
	import { ApiError } from '$lib/api/apiFetch';
	import { iniciarSesion, token } from '$lib/stores/sesion';
	import { esquemaLogin } from '$lib/schemas/login';
	import { claseInput } from '$lib/components/estilos';

	let email = $state('');
	let password = $state('');
	let errores = $state<Record<string, string>>({});
	let enviando = $state(false);
	let errorGeneral = $state<string | null>(null);

	$effect(() => {
		if ($token) void goto('/');
	});

	async function enviar(evento: SubmitEvent): Promise<void> {
		evento.preventDefault();
		errorGeneral = null;

		const resultado = esquemaLogin.safeParse({ email, password });
		if (!resultado.success) {
			const campos = resultado.error.flatten().fieldErrors;
			errores = Object.fromEntries(Object.entries(campos).map(([campo, msgs]) => [campo, msgs?.[0] ?? '']));
			return;
		}
		errores = {};
		enviando = true;
		try {
			const { accessToken } = await apiLogin(email, password);
			iniciarSesion(accessToken);
			await goto('/');
		} catch (e) {
			errorGeneral = e instanceof ApiError ? e.cuerpo.mensaje : 'No se pudo conectar con la API';
		} finally {
			enviando = false;
		}
	}
</script>

<div class="papel-rayado flex min-h-screen items-center justify-center p-4">
	<form onsubmit={enviar} class="tarjeta animar-entrada w-full max-w-sm p-8">
		<div class="mb-7 flex flex-col items-center text-center">
			<!-- Sello de la casa -->
			<svg viewBox="0 0 56 56" class="mb-4 h-14 w-14" aria-hidden="true">
				<circle cx="28" cy="28" r="26" fill="none" stroke="var(--color-cinta-500)" stroke-width="1.6" />
				<circle cx="28" cy="28" r="21" fill="none" stroke="var(--color-cinta-500)" stroke-width="0.9" opacity="0.7" />
				<text
					x="28"
					y="35.5"
					text-anchor="middle"
					font-family="IBM Plex Serif, Georgia, serif"
					font-size="19"
					font-weight="600"
					fill="var(--color-cinta-500)">GD</text>
			</svg>
			<h1 class="font-display text-2xl font-semibold text-(--texto-1)">Gestión documental</h1>
			<p class="mt-1.5 font-mono text-[11px] tracking-[0.18em] text-(--texto-3) uppercase">Archivo digital · Acceso</p>
		</div>
		<div class="flex flex-col gap-4">
			<div class="flex flex-col gap-1.5">
				<label for="email" class="text-sm font-medium text-(--texto-2)">Correo</label>
				<input id="email" type="email" bind:value={email} class={claseInput} autocomplete="username" />
				{#if errores.email}<p class="text-xs font-medium text-sello-600 dark:text-sello-500">{errores.email}</p>{/if}
			</div>
			<div class="flex flex-col gap-1.5">
				<label for="password" class="text-sm font-medium text-(--texto-2)">Contraseña</label>
				<input id="password" type="password" bind:value={password} class={claseInput} autocomplete="current-password" />
				{#if errores.password}<p class="text-xs font-medium text-sello-600 dark:text-sello-500">{errores.password}</p>{/if}
			</div>
			{#if errorGeneral}
				<p
					class="rounded-md border border-sello-100 bg-sello-50 px-3 py-2 text-sm text-sello-700 dark:border-sello-700/50 dark:bg-sello-700/20 dark:text-[#e8988e]"
				>
					{errorGeneral}
				</p>
			{/if}
			<button type="submit" disabled={enviando} class="btn btn-primario mt-2 w-full">
				{enviando ? 'Ingresando…' : 'Ingresar'}
			</button>
		</div>
	</form>
</div>
