# Plan: Frontend para el sistema de gestión documental

> Este documento es el plan de diseño para el frontend que consume la API descrita en
> `PLAN_API.md` (NestJS + Prisma, ya implementada en `api/`). No es código, es la hoja de ruta
> de qué construir, en qué orden, y con qué reglas de negocio. El frontend **no es dueño de
> ningún dato**: todo lo que muestra, valida o corrige pasa por la API — nunca habla con Prisma
> ni con el filesystem directamente.

---

## 1. Objetivo y alcance

Construir la interfaz que le permita a la persona que ya usa el pipeline de OCR:

- Ver un panel con el estado general del archivo (pendientes de revisar, libros con error, etc.).
- Buscar y filtrar documentos con los mismos filtros que ya expone la API (consecutivo, cédula,
  nombre, fechas, período, libro, revisar, motivo, texto libre).
- Ver el detalle de un documento con el PDF embebido, sin salir de la pantalla.
- Trabajar la cola de revisión (`revisar=true`) por lotes, agrupada por motivo.
- Corregir a mano cédula/nombre/fecha/consecutivo de un documento, con las mismas garantías que
  ya tiene la API (nunca sobreescribir un dato bueno, todo queda auditado).
- Subir un documento suelto (sin pasar por OCR) igual que `POST /documentos`.
- Subir un libro nuevo (PDF grande) y ver su progreso mientras el OCR corre en background.
- Ver personas y sus documentos, y detectar huecos en los consecutivos.
- Iniciar sesión y que la interfaz respete los 3 roles que ya define la API
  (`lector` / `editor` / `admin`).

Fuera de alcance por ahora (porque la API tampoco los expone hoy, ver sección 13):
gestión de usuarios desde la UI, visor de auditoría, notificaciones push, multi-idioma.

---

## 2. Principios de diseño

1. **El frontend es un cliente delgado de la API, no una segunda fuente de verdad.** Ningún
   cálculo de negocio (tendencia de consecutivo, deduplicar persona por cédula, decidir
   `motivo_revisar`) se repite en el frontend — eso ya vive en `api/src/documentos/documentos.service.ts`
   y equivalentes. El frontend solo pide, muestra, valida forma (no negocio) y envía.
2. **Todo dato dudoso se muestra como dudoso, nunca se disfraza.** Si `cedula`, `fecha` o
   `nombre` vienen `null` desde la API, la UI muestra un placeholder visualmente distinto
   (ej. "— sin dato —" en gris/itálica), nunca un valor inventado ni un campo vacío que parezca
   un error de carga. Esto es el mismo principio 3/4 de `PLAN_API.md` aplicado a la vista.
3. **Ninguna acción destructiva o de escritura sin confirmación explícita.** Eliminar un
   documento, corregir una cédula que va a fusionar con una persona existente, o reanudar un
   libro que falló: todas muestran un diálogo de confirmación con el detalle de qué va a pasar
   antes de llamar a la API.
4. **La sesión no sobrevive un rediseño de la API.** El frontend nunca hardcodea rutas o formas
   de respuesta a mano: los tipos TypeScript se derivan del contrato OpenAPI que ya expone
   `api` en `/api/docs-json` (ver sección 5), así un cambio de la API se nota en tiempo de
   compilación del frontend, no en producción.
5. **Un solo usuario, en su propia PC — pero la UI igual respeta roles.** No hay multi-tenant ni
   sesiones concurrentes que proteger, pero como la API ya modela `lector/editor/admin`, la UI
   oculta/deshabilita acciones que el rol actual no puede hacer, en vez de dejar que el usuario
   choque contra un 403.

---

## 3. Stack y arquitectura general

| Pieza              | Elección                          | Por qué |
|---------------------|-----------------------------------|---------|
| Framework           | **SvelteKit + TypeScript**        | Liviano, sin el boilerplate de React/Angular, buen ajuste para una app CRUD de un solo desarrollador (ya se descartó Astro por no encajar con una app dinámica, ver historial de decisiones). |
| Bundler/dev server  | Vite (viene con SvelteKit)        | Puerto de dev `5173`, ya habilitado en el CORS de la API (`api/src/main.ts`). |
| Render mode         | **SPA puro (`ssr = false` en el layout raíz)** | La API se autentica con JWT vía header `Authorization`, no con cookies — hacer SSR obligaría a reenviar el token a través del servidor de SvelteKit sin ninguna ganancia real (no hay SEO que optimizar en una herramienta interna de un solo usuario). Se simplifica a: el navegador pide todo directo a `http://localhost:3000/api/v1/*`. |
| Estilos             | Tailwind CSS                      | Consistencia rápida sin escribir un design system desde cero. |
| Componentes         | Un set propio y chico (Tabla, Modal, Badge, Botón, Campo) en vez de una librería grande | La superficie de la app es acotada (10 pantallas, ver sección 6); una librería tipo shadcn-svelte es válida si se quiere pulir más rápido, pero no es necesaria para el alcance actual. |
| Validación de forms | `zod`                             | Mismas reglas que los DTO de `class-validator` en la API (ej. `consecutivo` requerido, `email` válido), para dar feedback antes de llamar a la API. |
| Tipos de la API     | Generados con `openapi-typescript` desde `http://localhost:3000/api/docs-json` | Evita mantener a mano una copia de `DocumentoConRelaciones`, `BuscarDocumentosDto`, etc. — un script (`npm run generar-tipos-api`) los regenera cuando la API cambia. |
| Estado              | Stores nativos de Svelte (`writable`/`derived`) | Sesión (usuario/token) y filtros de búsqueda activos; no hace falta Redux/Zustand para esta escala. |

```
┌─────────────────────────┐        fetch + Bearer JWT        ┌───────────────────────┐
│  Navegador (SvelteKit,  │ ────────────────────────────────▶│  API (NestJS, :3000)  │
│  SPA en :5173 en dev)    │◀──────────────────────────────── │  /api/v1/*             │
└─────────────────────────┘        JSON / PDF (blob)          └───────────────────────┘
```

En producción (un solo usuario, una sola PC — igual que decidió `PLAN_API.md` sección 17), el
build estático de SvelteKit (`svelte-kit build` con adapter-static) se sirve desde el mismo
proceso Node de la API (Nest puede servir estáticos con `ServeStaticModule`) o se abre
directamente el `index.html` compilado — no hay que montar un hosting aparte.

---

## 4. Autenticación y sesión

- `POST /auth/login` (`email`, `password`) devuelve `{ accessToken }` — se guarda en
  `localStorage` bajo una sola clave (`gd_token`). Se eligió `localStorage` sobre
  `sessionStorage` porque es un solo usuario en su propia PC: conviene que la sesión sobreviva
  cerrar y abrir el navegador, no hay riesgo de "otro usuario en la misma pestaña".
- Cada request usa un wrapper `apiFetch(ruta, opciones)` que agrega
  `Authorization: Bearer <token>` automáticamente y lanza un error tipado si la respuesta no es
  `ok`, parseando el formato estándar de error de la API (`{ error, mensaje, detalle }`, ver
  `PLAN_API.md` sección 7.7).
- Si cualquier llamada devuelve `401`, el wrapper limpia el token y redirige a `/login` — no hay
  refresh token en la API (`PLAN_API.md` no define uno), así que al expirar el JWT
  (`JWT_EXPIRA_MIN`, hoy 60 min) el usuario simplemente vuelve a loguearse. Para esta escala, se
  sugiere subir `JWT_EXPIRA_MIN` a algo como `720` (12h) en el `.env` de la API en vez de
  construir un flujo de refresh — es una sola persona en su propia PC, no un riesgo real.
- El JWT trae `rol` en el payload (`sub`, `email`, `rol` — ver `api/src/auth/types.ts`); el
  frontend lo decodifica (sin validar firma, eso ya lo hizo el backend al emitirlo) solo para
  saber qué mostrar/ocultar en la UI. La autorización real siempre la vuelve a validar la API.
- No existe pantalla de "olvidé mi contraseña" ni de registro — el único usuario admin se crea
  con `api/scripts/crear-usuario.ts` (ver `PLAN_API.md` sección 15, Fase 2). Si se necesitan más
  usuarios (`editor`/`lector`), se crean con el mismo script por ahora.

---

## 5. Cliente de API

- Carpeta `src/lib/api/`: un archivo por recurso (`documentos.ts`, `personas.ts`, `libros.ts`,
  `reportes.ts`, `auth.ts`), cada uno son funciones delgadas sobre `apiFetch` que devuelven los
  tipos generados (sección 3). Ningún componente Svelte llama `fetch` directo.
- `PUBLIC_API_URL` (variable de entorno de Vite) apunta a `http://localhost:3000` en dev; en el
  build de producción servido junto a la API puede quedar en `""` (mismo origen, rutas
  relativas).
- Descarga/visualización de PDF: como `GET /documentos/{id}/archivo` requiere el header
  `Authorization`, **no se puede usar directo como `src` de un `<iframe>`** (el navegador no
  manda headers custom en una carga de recurso). El cliente hace `fetch` con el token, recibe el
  PDF como `Blob`, arma un `URL.createObjectURL(blob)` y ese es el `src` del visor. El object URL
  se revoca (`URL.revokeObjectURL`) al salir de la pantalla de detalle, para no dejar PDFs con
  datos personales flotando en memoria del navegador más de lo necesario (coherente con la
  sección 11 de `PLAN_API.md`, cifrado/retención de datos personales).
- Paginación: los componentes de tabla reciben `{ total, page, page_size, resultados }` tal cual
  lo devuelve la API (`PLAN_API.md` sección 7.1) — no se recalcula nada de paginación en el
  cliente.

---

## 6. Mapa de pantallas y rutas

| Ruta                          | Pantalla                    | Endpoint(s) principal(es)                              | Rol mínimo |
|--------------------------------|------------------------------|-----------------------------------------------------------|------------|
| `/login`                      | Iniciar sesión               | `POST /auth/login`                                         | público |
| `/`                            | Panel / resumen              | `GET /reportes/resumen`, `GET /health`                     | lector |
| `/documentos`                 | Buscar/filtrar documentos    | `GET /documentos`                                           | lector |
| `/documentos/nuevo`           | Carga manual de un documento | `POST /documentos`                                          | editor |
| `/documentos/[id]`            | Detalle + visor PDF          | `GET /documentos/{id}`, `GET /documentos/{id}/archivo`      | lector |
| `/documentos/[id]/editar`     | Corregir cédula/nombre/fecha | `PATCH /documentos/{id}`                                     | editor |
| `/revision`                   | Cola de revisión             | `GET /documentos?revisar=true` (agrupado por `motivo_revisar`) | lector |
| `/consecutivos`               | Listado + huecos             | `GET /documentos/consecutivos`, `GET /documentos/consecutivos/huecos` | lector |
| `/personas`                   | Buscar personas              | `GET /personas`                                             | lector |
| `/personas/[id]`              | Detalle + sus documentos     | `GET /personas/{id}`, `GET /personas/{id}/documentos`       | lector |
| `/libros`                     | Listado de libros             | `GET /libros`                                               | lector |
| `/libros/nuevo`               | Subir un libro (PDF grande)  | `POST /libros`                                               | admin |
| `/libros/[id]`                | Detalle + progreso            | `GET /libros/{id}`, `GET /libros/{id}/estado`, `GET /libros/{id}/documentos` | lector (ver), admin (reanudar) |

Layout: barra lateral fija con los 6 grupos (Panel, Documentos, Revisión, Consecutivos,
Personas, Libros), header con usuario actual + botón de logout. Las entradas de menú que el rol
actual no puede usar (ej. "Subir libro" para un `lector`) no se ocultan del todo — se muestran
deshabilitadas con un tooltip ("Necesitas rol admin"), para que quede claro que la función
existe pero no está disponible para ese usuario.

---

## 7. Reglas de negocio de UI (por pantalla)

### 7.1 Buscar documentos (`/documentos`)
- Filtros como en `BuscarDocumentosDto`: consecutivo (exacto), rango de consecutivo, cédula,
  nombre, rango de fechas, período (`AAAA-MM`), libro, `revisar`, `motivo_revisar`, texto libre
  `q`, orden y paginación. Los filtros activos se reflejan en la URL (`?cedula=...&revisar=true`)
  para poder compartir/recargar una búsqueda.
- Cada fila muestra un badge de estado: `ok` (verde), `revisar` (amarillo, con el motivo como
  tooltip), y si `origen='manual'` un badge secundario distinguiéndolo de lo que vino de OCR.
- Debounce de 300ms en el campo de texto libre antes de disparar la búsqueda, para no golpear la
  API en cada tecla.

### 7.2 Detalle de documento (`/documentos/[id]`)
- Visor de PDF embebido (ver sección 5) + botón "Descargar" (mismo blob, `<a download>`) y botón
  "Abrir en pestaña nueva".
- Panel lateral con persona (cédula, nombre, link a `/personas/[id]` si tiene), libro de origen
  (link a `/libros/[id]` si `libro_id` no es null, o badge "Carga manual" si es null), fechas,
  consecutivo, y el motivo de revisión si aplica.
- Botones "Editar" (rol editor+) y "Eliminar" (rol admin) solo visibles según el rol; "Eliminar"
  siempre pide confirmación explicando que es un soft-delete (`DELETE` marca `eliminado_en`, no
  borra el PDF físico — mismo comportamiento que `PLAN_API.md` sección 7.1).

### 7.3 Corregir un documento (`/documentos/[id]/editar`)
- Formulario con cédula, nombre, fecha, consecutivo — todos opcionales (solo se envían los
  campos que la persona realmente cambió, igual que `ActualizarDocumentoDto`).
- **Antes de enviar**, si la cédula escrita es distinta a la actual, el formulario hace un
  `GET /personas?q=<cedula>` y si encuentra una persona existente muestra un aviso: "Esta cédula
  ya pertenece a **{nombre}** (N documentos) — este documento se va a vincular a esa persona en
  vez de crear una nueva." Esto es UI puro sobre una regla que la API ya garantiza
  (`getOrCreatePersona`), pero evita sorpresas.
- Al guardar, éxito visible con un toast y redirección al detalle; el documento corregido pasa a
  `revisar=false` / `motivo_revisar='corregido_manual'` — la UI lo refleja de inmediato sin
  esperar un refetch completo (actualización optimista sobre la respuesta del `PATCH`).

### 7.4 Carga manual (`/documentos/nuevo`)
- Formulario multipart: archivo PDF (requerido, valida `type === 'application/pdf'` y un tamaño
  máximo razonable en cliente, ej. 50MB, antes de subir), consecutivo (requerido), cédula,
  nombre, fecha (opcionales) — igual que `CrearDocumentoManualDto`.
- Si la API responde con `revisar: true` (por ejemplo porque el consecutivo rompe tendencia), la
  pantalla de éxito lo muestra igual de visible que un error, no lo esconde detrás de un simple
  "guardado" — el objetivo es que quien sube el documento sepa que quedó en la cola de revisión.

### 7.5 Cola de revisión (`/revision`)
- Atajo de `/documentos?revisar=true`, pero agrupado visualmente por `motivo_revisar`
  (`sin_cedula`, `sin_fecha`, `consecutivo_repetido`, `consecutivo_fuera_de_tendencia`,
  `corregido_manual` no debería aparecer aquí porque ya no tiene `revisar=true`). Cada grupo es
  una sección colapsable con su conteo, para poder "hoy reviso todos los que no tienen cédula"
  (caso de uso explícito de `PLAN_API.md` sección 10).
- Acción rápida "Corregir" en cada fila lleva directo a `/documentos/[id]/editar`.

### 7.6 Consecutivos y huecos (`/consecutivos`)
- Selector de libro (opcional, si no se elige ninguno usa el listado global).
- Tabla compacta de `GET /documentos/consecutivos` (id, consecutivo, estado `ok/revisar/duplicado`).
- Bloque separado con el resultado de `GET /documentos/consecutivos/huecos`: rango detectado y
  lista de números faltantes, con un aviso claro de que un hueco no siempre es un error (puede
  ser una anulación legítima) — coherente con el comentario de `check_consecutivo` en
  `split_consecutivos.py` original.

### 7.7 Libros (`/libros`, `/libros/nuevo`, `/libros/[id]`)
- Listado con badge de estado (`pendiente`/`procesando`/`completado`/`error`) y barra de
  progreso simple (`documentos_generados` sobre `total_paginas` cuando este último no es null;
  si es null, se muestra solo el conteo sin barra).
- **Mientras `estado='procesando'`**, la pantalla de detalle hace polling a
  `GET /libros/{id}/estado` cada 5 segundos (se detiene solo al llegar a `completado` o `error`)
  — no hay websockets, coherente con la decisión de `PLAN_API.md` sección 8.
- Si `estado='error'`, se muestra `error_detalle` completo (colapsable, puede ser largo) y el
  botón "Reanudar" (rol admin) que llama `POST /libros/{id}/reanudar` con una confirmación que
  explica que va a continuar desde la última página procesada, no desde el inicio.
- Subir un libro nuevo: solo el archivo (PDF grande — advertir en la UI que puede tardar minutos
  u horas y que se puede cerrar la pestaña, el proceso sigue en el servidor).

### 7.8 Personas (`/personas`, `/personas/[id]`)
- Búsqueda por cédula/nombre parcial. Detalle muestra todos sus documentos activos
  (`eliminado_en IS NULL`) con link a cada uno.

### 7.9 Panel / resumen (`/`)
- Tarjetas con los números de `GET /reportes/resumen` (total documentos, pendientes de revisar,
  personas sin cédula, libros con error) y un indicador de `GET /health` (verde/rojo) en el
  header, para notar de inmediato si la API o el storage tienen un problema.

---

## 8. Roles y permisos en la UI

| Acción                                   | lector | editor | admin |
|--------------------------------------------|:------:|:------:|:-----:|
| Ver/buscar/descargar documentos, personas, libros | ✅ | ✅ | ✅ |
| Corregir documento (`PATCH`)                | ❌ | ✅ | ✅ |
| Cargar documento manual (`POST /documentos`) | ❌ | ✅ | ✅ |
| Eliminar documento (soft delete)            | ❌ | ❌ | ✅ |
| Subir libro nuevo                            | ❌ | ❌ | ✅ |
| Reanudar libro en error                      | ❌ | ❌ | ✅ |

La tabla es el reflejo exacto de `@Roles(...)` en los controllers de `api/src/**/*.controller.ts`
— si algún día cambian los decoradores de rol en la API, esta tabla (y los `if` de la UI) hay
que actualizarlos juntos.

---

## 9. Manejo de errores y estados

- Todo error de la API sigue el formato `{ error, mensaje, detalle }` (`PLAN_API.md` 7.7). El
  cliente lo traduce a un toast con `mensaje`; si `detalle` es un array (errores de validación de
  `class-validator`), se listan campo por campo debajo del formulario en vez de un toast genérico.
- Estados de carga: skeleton simple en tablas y detalle (no spinners de página completa) para que
  la navegación se sienta rápida aunque la API tarde.
- Estados vacíos explícitos por pantalla ("No hay documentos con estos filtros" con botón para
  limpiar filtros; "No hay nada pendiente de revisar 🎉" en `/revision`).
- Si `GET /health` devuelve `estado != 'ok'`, se muestra un banner persistente en el header
  ("Problema de conexión con la base de datos o el almacenamiento") — evita que el usuario
  interprete resultados vacíos como "no hay datos" cuando en realidad la API está degradada.

---

## 10. Validación de formularios

- Esquemas `zod` en `src/lib/schemas/` que reflejan 1:1 los DTO de la API (mismo nombre de campo,
  mismas reglas: `consecutivo` string requerido, `email` formato válido, `password` mínimo 8
  caracteres, fechas `YYYY-MM-DD`). Sirven para dar feedback inmediato en el formulario, pero la
  API sigue siendo la validación autoritativa — un zod desactualizado nunca debe poder "colar"
  algo que la API rechazaría.
- Errores de validación se muestran junto al campo, no en un resumen aparte, para que sea obvio
  qué corregir.

---

## 11. Fuera de alcance (por falta de endpoints en la API)

Estas pantallas **no se construyen todavía** porque `PLAN_API.md` no define los endpoints que
necesitarían — se documentan aquí para no perder la idea, no para implementarlas ya:

- **Gestión de usuarios desde la UI** (crear/desactivar/cambiar rol): la API solo tiene
  `POST /auth/login`; crear usuarios es hoy un script de CLI (`crear-usuario.ts`). Si se quiere
  esta pantalla, primero hay que agregar endpoints `POST/GET/PATCH /usuarios` a la API (rol
  admin) — no se debe construir un formulario que llame a un endpoint que no existe.
- **Visor de auditoría** (quién vio/descargó/editó qué): la tabla `auditoria` existe en el
  schema de Prisma y ya se escribe en cada acción relevante, pero no hay `GET /auditoria` en la
  API. Se deja como candidato natural para una fase futura, ver `PLAN_API.md` sección 15.
- **Cambio de contraseña / recuperación**: no hay endpoint; el único usuario se gestiona por CLI.

---

## 12. Estructura de carpetas propuesta

```
frontend/
├── src/
│   ├── routes/
│   │   ├── login/+page.svelte
│   │   ├── +layout.svelte              # guard de sesión + barra lateral
│   │   ├── +page.svelte                # panel/resumen
│   │   ├── documentos/
│   │   │   ├── +page.svelte            # buscar/filtrar
│   │   │   ├── nuevo/+page.svelte      # carga manual
│   │   │   └── [id]/
│   │   │       ├── +page.svelte        # detalle + visor
│   │   │       └── editar/+page.svelte
│   │   ├── revision/+page.svelte
│   │   ├── consecutivos/+page.svelte
│   │   ├── personas/
│   │   │   ├── +page.svelte
│   │   │   └── [id]/+page.svelte
│   │   └── libros/
│   │       ├── +page.svelte
│   │       ├── nuevo/+page.svelte
│   │       └── [id]/+page.svelte
│   ├── lib/
│   │   ├── api/                        # cliente delgado (seccion 5)
│   │   │   ├── apiFetch.ts
│   │   │   ├── documentos.ts
│   │   │   ├── personas.ts
│   │   │   ├── libros.ts
│   │   │   ├── reportes.ts
│   │   │   └── auth.ts
│   │   ├── types/                      # generados con openapi-typescript
│   │   ├── schemas/                    # zod
│   │   ├── stores/
│   │   │   ├── sesion.ts               # usuario, token, rol
│   │   │   └── filtrosDocumentos.ts
│   │   └── components/
│   │       ├── Tabla.svelte
│   │       ├── Modal.svelte
│   │       ├── Badge.svelte
│   │       ├── VisorPdf.svelte
│   │       └── CampoFormulario.svelte
│   └── app.html
├── static/
├── .env.example                        # PUBLIC_API_URL
├── svelte.config.js
├── vite.config.ts
└── package.json
```

---

## 13. Configuración (variables de entorno)

| Variable          | Ejemplo dev                     | Ejemplo prod (mismo origen que la API)   |
|-------------------|----------------------------------|--------------------------------------------|
| `PUBLIC_API_URL`  | `http://localhost:3000`          | `""` (rutas relativas, mismo servidor)     |

---

## 14. Testing

- No se plantea una suite grande dado el tamaño del equipo (una persona) y el alcance (uso
  interno). Prioridad, en este orden:
  1. Pruebas manuales guiadas por esta misma sección 7 (reglas de negocio) antes de cada release.
  2. Tests de componente (Vitest + Testing Library) solo para los componentes con lógica no
     trivial: `VisorPdf` (manejo del blob/object URL), el formulario de corrección (el aviso de
     cédula duplicada), y el polling de `/libros/[id]`.
  3. Un test end-to-end (Playwright) del camino feliz completo: login → subir documento manual →
     verlo en la búsqueda → corregirlo → verlo salir de la cola de revisión. Sirve como smoke
     test de que frontend y API siguen hablando el mismo idioma tras un cambio.

---

## 15. Roadmap por fases

**Fase 0 — Fundación:**
- [ ] Scaffold SvelteKit + TypeScript + Tailwind, SPA mode.
- [ ] Generación de tipos desde el OpenAPI de la API (`openapi-typescript`).
- [ ] Cliente `apiFetch` con manejo de 401 y del formato de error estándar.
- [ ] Pantalla de login + store de sesión + guard en `+layout.svelte`.

**Fase 1 — Lectura (equivalente a la Fase 1 de la API):**
- [ ] Panel/resumen, buscar documentos, detalle + visor PDF, personas, libros (listado/detalle).

**Fase 2 — Escritura:**
- [ ] Carga manual de documento, corrección (`PATCH`), eliminar (soft delete), cola de revisión,
      consecutivos/huecos.

**Fase 3 — Ingesta:**
- [ ] Subir libro + pantalla de progreso con polling + reanudar.

**Fase 4 — Pulido:**
- [ ] Estados vacíos/error consistentes en todas las pantallas, accesibilidad básica (foco,
      contraste, navegación por teclado en modales), responsive (aunque sea un solo usuario en
      su PC, vale la pena que funcione si algún día abre la app desde el celular en la misma red).
- [ ] Build de producción servido junto a la API (mismo origen, sin CORS que mantener).

---

## 16. Resumen de decisiones clave

- **SvelteKit + TypeScript, en modo SPA puro (sin SSR).** No hay cookies de sesión que reenviar
  ni SEO que ganar; simplifica el modelo mental a "el navegador le habla directo a la API".
- **El frontend nunca duplica reglas de negocio de la API** — ni la detección de tendencia de
  consecutivo, ni la deduplicación de personas. Solo replica *validaciones de forma* (zod) para
  dar feedback rápido, siempre confirmado por la API al final.
- **Los tipos se generan desde el OpenAPI de la API, no se escriben a mano** — mantiene
  frontend y backend sincronizados sin esfuerzo manual cada vez que cambia un DTO.
- **No se construyen pantallas para endpoints que no existen** (gestión de usuarios, auditoría) —
  se documentan como pendientes en vez de simularlas con datos falsos o rutas rotas.
- **Roles ocultan/deshabilitan, no solo protegen:** un `lector` no debería ni ver el botón de
  "Subir libro" activo, aunque la API igual lo rechazaría con 403 si lo intentara.
