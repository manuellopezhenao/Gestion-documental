// SPA pura (PLAN_FRONTEND.md seccion 3): la API se autentica con Bearer JWT,
// no con cookies, asi que SSR no aporta nada y solo complica el reenvio del token.
export const ssr = false;
export const prerender = false;
