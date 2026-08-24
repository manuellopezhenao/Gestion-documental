import { apiFetch } from './apiFetch';

export function login(email: string, password: string): Promise<{ accessToken: string }> {
	return apiFetch('/api/v1/auth/login', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password })
	});
}

export function logout(): Promise<{ ok: boolean }> {
	return apiFetch('/api/v1/auth/logout', { method: 'POST' });
}
