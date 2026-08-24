# Plan: API para el sistema de gestión documental

> Este documento es el plan de diseño para una API que exponga todo lo que hoy vive en
> `split_facturas/documentos.db` (y lo que se siga generando) como un sistema de gestión real:
> buscar, filtrar, ver/descargar archivos, listar consecutivos, revisar pendientes, etc.
>
> **Stack:** Node.js + TypeScript + NestJS + Prisma (ver sección 17 para el porqué, incluida la
> decisión de mantener el pipeline de OCR en Python en vez de reescribirlo). El código vive en
> `api/` y ya implementa las fases 0-2 de la sección 15; ver sección 14 para el árbol real.

---

## 1. Objetivo y alcance

Construir una API que permita:

- Buscar y filtrar documentos por consecutivo, cédula, nombre, fecha/período, libro de origen y estado de revisión.
- Ver/descargar el PDF individual de un documento.
- Listar y auditar consecutivos (detectar huecos, duplicados, saltos de tendencia).
- Consultar personas (por cédula) y ver todos sus documentos.
- Corregir manualmente los datos que el OCR no pudo leer bien (cola de revisión).
- Subir/procesar nuevos "libros" (PDFs grandes) sin bloquear la API mientras se hace OCR.
- Subir un documento suelto **a mano** (sin pasar por OCR): la persona sube el PDF y escribe consecutivo/cédula/nombre/fecha directamente, y el sistema lo organiza y guarda exactamente igual que si hubiera venido del pipeline automático.
- Migrar de SQLite (hoy, para pruebas) a MySQL (producción) sin reescribir la lógica de negocio.

Fuera de alcance por ahora (pero se deja espacio para): frontend web, OCR con mejor motor, facturación/flujos de aprobación.

---

## 2. Principios de diseño

1. **La base de datos es un detalle de infraestructura, no el centro del diseño.** Todo acceso a datos pasa por un ORM (Prisma) y un patrón repositorio, nunca SQL crudo disperso en los endpoints. Esto es lo que realmente permite pasar de SQLite a MySQL sin dolor.
2. **El script de OCR (`split_consecutivos.py`) sigue siendo Python, la API es Node — no comparten proceso ni ORM, comparten un contrato de importación.** Se evaluó reescribir el OCR en Node (PyMuPDF/Tesseract/regex/sqlite tienen equivalentes razonables: `pdf-lib`, `node-tesseract-ocr` sobre el mismo Tesseract ya instalado, `pdf-poppler` sobre Poppler, `better-sqlite3`) pero se descartó: el script ya funciona y tiene lógica delicada (voto por mayoría de cédula/nombre, detección de tendencia del consecutivo) que reescribir no mejora, solo arriesga. En cambio, el script sigue siendo "el productor" tal cual está, y la API lo corre como proceso hijo (`child_process.spawn`, igual que ya se hace con Tesseract/Poppler) y **después** importa las filas nuevas de su sqlite hacia el schema de Prisma — ver `api/src/libros/jobs/procesar-libro.job.ts` y sección 8.
3. **Nunca se pierde un dato bueno por uno malo.** Igual que ya se hizo con `personas` (no se sobreescribe un nombre bueno con uno peor), toda corrección automática debe ser aditiva, nunca destructiva. Las correcciones destructivas (borrar, sobreescribir cédula) solo las hace un humano vía la cola de revisión.
4. **Todo dato dudoso queda visible, no oculto.** Los documentos con `revisar=1`, sin cédula, sin fecha exacta, etc. no se esconden: hay endpoints y filtros específicos para encontrarlos.
5. **Los archivos y la base de datos pueden evolucionar por separado.** El almacenamiento de PDFs se abstrae detrás de una interfaz simple, para poder pasar de "carpeta local" a un bucket (S3/MinIO) sin tocar los endpoints.

---

## 3. Arquitectura general

```
┌─────────────────────┐  proceso  ┌───────────────────────────────┐
│  split_consecutivos  │  hijo +  │        API (NestJS)            │
│  (Python, intacto)   │─────────▶│                                 │
└─────────┬────────────┘  import  │  controllers/ (HTTP)            │
          │                       │  services/    (reglas negocio)  │
          │ escribe en su         │  repositories/(acceso DB)       │
          │ propia sqlite         │  prisma/schema.prisma (modelos) │
          ▼                       └──────────┬──────────────────────┘
   ┌──────────────┐                          │
   │   Storage     │◀─────────────────────────┘
   │ (filesystem   │
   │  hoy, S3 luego)│
   └──────┬────────┘
          │
   ┌──────▼────────┐
   │  Base de datos │  SQLite (dev/test) ──▶ MySQL (prod)
   │  (vía Prisma)  │
   └───────────────┘
```

Capas (dentro de `api/src/`):

- **prisma/schema.prisma**: definición de tablas con Prisma (única fuente de verdad del esquema).
- **\*/\*.repository.ts**: consultas concretas (`DocumentosRepository.buscar(filtros)`, `PersonasRepository.porCedula(...)`). Es la única capa que conoce Prisma/SQL.
- **\*/\*.service.ts**: reglas de negocio (ej. "marcar revisar si el consecutivo rompe tendencia", "no crear persona duplicada"). No conocen HTTP.
- **\*/\*.controller.ts**: los endpoints HTTP (decorators de NestJS), solo traducen request → service → response.
- **storage/**: interfaz `Storage` (`guardar`, `leer`, `existe`, `eliminar`) — hoy implementada con `FilesystemStorage`, mañana con S3/MinIO.
- **libros/jobs/**: procesamiento asíncrono de PDFs nuevos, incluida la llamada al script Python (ver sección 8).

---

## 4. Modelo de datos objetivo

Esto **evoluciona** el esquema actual (`personas` + `documentos`) agregando lo que falta para que la API sea completa: una tabla para los "libros" de origen, y campos que hoy son texto libre y deberían ser tipos reales (fechas, no strings).

### 4.1 `libros` (nuevo)

Hoy cada fila de `documentos` repite el path del PDF de origen como texto. Con muchos libros procesados, eso no escala para "listar libros", "ver progreso de un libro", "reprocesar un libro". Se normaliza:

| Campo               | Tipo         | Notas                                                        |
|---------------------|--------------|---------------------------------------------------------------|
| id                  | INTEGER PK   | autoincrement, PK interno                                     |
| nombre_archivo      | VARCHAR(255) | ej. "LIBRO 2-2 ENERO 2024.pdf"                                 |
| ruta_origen         | VARCHAR(500) | path completo o key en storage                                 |
| periodo_libro       | DATE         | primer día del mes inferido del nombre (ej. 2024-01-01)        |
| total_paginas       | INTEGER      | calculado al iniciar el procesamiento                          |
| documentos_generados| INTEGER      | contador, se actualiza a medida que se procesa                 |
| consecutivo_min     | INTEGER      | mínimo consecutivo detectado en este libro                     |
| consecutivo_max     | INTEGER      | máximo consecutivo detectado en este libro                     |
| estado              | VARCHAR(20)  | `pendiente` / `procesando` / `completado` / `error`             |
| error_detalle       | TEXT         | si `estado='error'`, el traceback o mensaje                     |
| iniciado_en         | DATETIME     | cuándo arrancó el job                                            |
| finalizado_en       | DATETIME     | NULL si sigue en curso                                          |

### 4.2 `personas` (ya existe, se mantiene)

| Campo   | Tipo         | Notas                                    |
|---------|--------------|-------------------------------------------|
| id      | INTEGER PK   | autoincrement                             |
| cedula  | VARCHAR(20)  | UNIQUE, NULL si nunca se identificó        |
| nombre  | VARCHAR(200) | se completa solo si estaba vacío           |
| creado_en | DATETIME   | nuevo: para auditoría                      |
| actualizado_en | DATETIME | nuevo: última vez que se corrigió el nombre |

> Nota MySQL: `cedula TEXT UNIQUE` (como está hoy en SQLite) **no funciona igual en MySQL** — un `UNIQUE` sobre `TEXT` requiere especificar una longitud de índice. Por eso se define como `VARCHAR(20)`, no `TEXT`. Ver sección 10.

### 4.3 `documentos` (se ajusta)

| Campo          | Tipo         | Notas                                                                |
|----------------|--------------|------------------------------------------------------------------------|
| id             | INTEGER PK   | autoincrement, PK interno — **nunca** el consecutivo del papel          |
| libro_id       | INTEGER FK   | referencia a `libros.id`; **NULL si el documento se subió a mano** (no viene de un libro escaneado) |
| origen         | VARCHAR(10)  | nuevo: `"ocr"` o `"manual"` — de dónde salió el documento               |
| persona_id     | INTEGER FK   | NULL si no se identificó cédula                                        |
| consecutivo    | VARCHAR(20)  | tal como se leyó, o el que se escribió a mano                          |
| consecutivo_num| INTEGER      | nuevo: versión numérica cuando se pudo parsear, para poder ordenar/filtrar por rango sin castear en cada query |
| fecha          | DATE         | antes era TEXT "2024/01/31"; pasa a DATE real (NULL si no se leyó)      |
| periodo_libro  | DATE         | primer día del mes del libro (fallback de `fecha`)                      |
| revisar        | BOOLEAN      | ya existe, se mantiene                                                  |
| motivo_revisar | VARCHAR(50)  | nuevo: `"consecutivo_repetido"` / `"consecutivo_fuera_de_tendencia"` / `"sin_cedula"` / `"sin_fecha"` / `"corregido_manual"` — para poder filtrar la cola de revisión por causa |
| pagina_inicio  | INTEGER      |                                                                          |
| pagina_fin     | INTEGER      |                                                                          |
| archivo_path   | VARCHAR(500) | path relativo o key en storage (no absoluto, para portabilidad)         |
| tamano_bytes   | INTEGER      | nuevo: útil para mostrar en listados y detectar archivos corruptos/vacíos |
| hash_sha256    | VARCHAR(64)  | nuevo: checksum del PDF generado — detecta duplicados y verifica integridad con el tiempo |
| procesado_en   | DATETIME     |                                                                          |
| eliminado_en   | DATETIME     | nuevo: soft delete (ver 7.1) — NULL = activo                             |

Índices clave: `consecutivo_num`, `fecha`, `persona_id`, `libro_id`, `revisar`, `eliminado_en`.

### 4.4 `usuarios` (nuevo, para cuando haya autenticación)

| Campo         | Tipo         | Notas                              |
|---------------|--------------|-------------------------------------|
| id            | INTEGER PK   |                                      |
| email         | VARCHAR(200) | UNIQUE                              |
| password_hash | VARCHAR(255) | bcrypt/argon2, nunca texto plano    |
| rol           | VARCHAR(20)  | `admin` / `editor` / `lector`       |
| activo        | BOOLEAN      |                                      |
| creado_en     | DATETIME     |                                      |

### 4.5 `auditoria` (nuevo)

Registro de quién hizo qué — importante en un sistema de gestión documental con datos personales.

| Campo         | Tipo         | Notas                                                  |
|---------------|--------------|----------------------------------------------------------|
| id            | INTEGER PK   |                                                            |
| usuario_id    | INTEGER FK   | NULL si fue el propio pipeline OCR                         |
| accion        | VARCHAR(50)  | `ver` / `descargar` / `editar` / `eliminar` / `subir_libro` |
| documento_id  | INTEGER FK   | nullable (algunas acciones no son sobre un documento)      |
| detalle       | TEXT         | JSON con lo que cambió (antes/después) si aplica            |
| fecha         | DATETIME     |                                                            |

---

## 5. Portabilidad SQLite → MySQL

Esto es lo que garantiza que "empezar en SQLite" no sea una trampa después:

1. **ORM obligatorio, nada de SQL crudo específico de un motor.** El script Python actual usa `sqlite3` directo con `INTEGER PRIMARY KEY AUTOINCREMENT` — sintaxis de SQLite, y sigue así (se mantiene intacto, ver sección 2). La API en Node nunca toca esa base directamente para escribir: define su propio schema en `api/prisma/schema.prisma` (`id Int @id @default(autoincrement())`), que Prisma traduce automáticamente a `AUTO_INCREMENT` en MySQL.
2. **Migraciones con Prisma Migrate** (`prisma migrate dev` / `prisma migrate deploy`), no `CREATE TABLE IF NOT EXISTS` a mano. Un mismo set de migraciones (`api/prisma/migrations/`) corre contra SQLite (dev) y MySQL (prod).
3. **Tipos de datos pensados para ambos motores desde ya:**
   - Mientras el `provider` del datasource es `sqlite`, el schema **no** lleva anotaciones `@db.VarChar(n)` porque el conector de sqlite no las soporta (ver comentario al inicio de `schema.prisma`). Al migrar a MySQL es el momento de agregarlas en `cedula`/`consecutivo`/`nombre`/etc.
   - Fechas: se guardan como `DateTime` real en el modelo Prisma (`fecha`, `periodoLibro`, etc.), nunca como string tipo `"2024/01/31"`. El script Python sigue guardando fechas como texto en su propia base — la conversión a `Date` ocurre en el import (`procesar-libro.job.ts` / `scripts/migrar-desde-python.ts`), no se hereda el formato de texto hacia el schema nuevo.
   - Definir `charset=utf8mb4` / collation `utf8mb4_unicode_ci` en el connection string de MySQL (`?charset=utf8mb4`), para que nombres con Ñ/tildes se busquen y ordenen bien (SQLite es más permisivo por defecto y esto puede pasar desapercibido hasta el día de la migración).
4. **Connection string por variable de entorno** (`DATABASE_URL`, cargada vía `@nestjs/config`), nunca hardcodeada. Ejemplo:
   - Dev/test: `file:./dev.db` (relativo a `api/prisma/`)
   - Prod: `mysql://usuario:password@host:3306/gestion_doc`
   Solo cambia `provider` en `schema.prisma` (`sqlite` → `mysql`) y la URL; el código de acceso a datos (repositories) no cambia.
5. **Concurrencia:** SQLite solo permite un escritor a la vez (bueno para el pipeline batch de hoy, insuficiente para una API con varios usuarios + un job de OCR escribiendo al mismo tiempo). Mientras se sigue en SQLite para pruebas, el plan asume que **el ambiente multiusuario real necesita MySQL**, no es opcional a largo plazo.
6. **Claves foráneas:** Prisma las declara en el schema (`@relation`, `onDelete`) y SQLite las respeta si `foreign_keys` está activo (Prisma lo activa por defecto); en MySQL/InnoDB están activas por defecto. No se confía en el comportamiento implícito de cada motor.
7. **Checklist de corte SQLite → MySQL (cuando llegue el momento):**
   - [ ] Levantar MySQL (local o gestionado), cambiar `provider = "mysql"` en `schema.prisma` y `DATABASE_URL`, correr `prisma migrate deploy`.
   - [ ] Migrar los datos existentes (`api/scripts/migrar-desde-python.ts` ya cubre sqlite-Python → Prisma-sqlite; para sqlite-Prisma → MySQL el mismo patrón aplica: leer con `PrismaClient` apuntando a sqlite, insertar con `PrismaClient` apuntando a MySQL — no dump/restore manual de SQL crudo).
   - [ ] Validar conteos de filas por tabla (sqlite vs MySQL) antes de cortar tráfico.
   - [ ] Cambiar `DATABASE_URL` en el entorno de la API.
   - [ ] Smoke test: correr la colección de endpoints clave (buscar, ver archivo, listar consecutivos) contra MySQL antes de apagar sqlite.

---

## 6. Almacenamiento de archivos

- **Hoy:** filesystem local, organizado `output/AAAA/MM/<consecutivo>_<cedula>.pdf` (ya implementado).
- **Abstracción:** una interfaz `Storage` con `guardar(ruta, bytes)`, `leer(ruta) -> bytes`, `existe(ruta) -> bool`, `eliminar(ruta)`. La API y el pipeline OCR usan esta interfaz, no `open()`/`os.path` directo.
- **Implementación inicial:** `FilesystemStorage` (lo que ya hay).
- **Implementación futura (sin cambiar el resto del sistema):** `S3Storage` / `MinioStorage`, útil si el sistema deja de correr en una sola máquina con OneDrive.
- **Servir el PDF vía API:** la respuesta de "ver archivo" nunca debe aceptar un path completo del cliente (evitar path traversal) — el endpoint recibe un `id` de documento, la API resuelve internamente la ruta real vía el repositorio, nunca confía en un path que venga del request.
- **Cuidado con OneDrive:** la carpeta del proyecto está sincronizada con OneDrive; en producción esto puede causar bloqueos de archivo intermitentes (ya se sospechó como causa de un error anterior). Se recomienda que el almacenamiento "real" de producción NO viva dentro de una carpeta sincronizada por OneDrive.

---

## 7. Especificación de la API

Prefijo sugerido: `/api/v1`. Formato: JSON, con documentación automática vía OpenAPI/Swagger (gratis si se usa FastAPI).

### 7.1 Documentos

| Método | Ruta                          | Descripción                                                                 |
|--------|-------------------------------|-------------------------------------------------------------------------------|
| GET    | `/documentos`                 | Buscar/filtrar (ver parámetros abajo) + paginación                            |
| GET    | `/documentos/{id}`            | Detalle completo (incluye persona y libro embebidos)                          |
| GET    | `/documentos/{id}/archivo`    | Descarga/stream del PDF (`?modo=inline` para verlo en el navegador)           |
| POST   | `/documentos`                 | **Carga manual**: sube un PDF suelto + los datos escritos a mano (consecutivo, cédula, nombre, fecha) — ver 7.1.1 |
| PATCH  | `/documentos/{id}`            | Corrección manual (cédula, nombre, fecha) — solo `editor`/`admin`, va a `auditoria` |
| DELETE | `/documentos/{id}`            | Soft delete (`eliminado_en`), nunca borra el PDF físico de una                 |
| GET    | `/documentos/consecutivos`    | Listado compacto: consecutivo, id, estado (`ok`/`revisar`/`duplicado`)         |
| GET    | `/documentos/consecutivos/huecos` | Detecta números faltantes en el rango esperado de un libro/período        |

#### 7.1.1 Carga manual de un documento (`POST /documentos`)

No todo documento va a venir de un libro escaneado por OCR — a veces alguien tiene un PDF suelto (una factura nueva, un comprobante que no estaba en el libro) y necesita subirlo y clasificarlo directamente. Este endpoint cubre eso:

- **Request:** `multipart/form-data` con el archivo PDF + campos: `consecutivo` (obligatorio), `cedula` (opcional), `nombre` (opcional), `fecha` (opcional, si no se sabe se puede omitir).
- **Reutiliza exactamente la misma lógica que el pipeline automático**, no un camino paralelo distinto:
  - `get_or_create_persona`: si la cédula ya existe, se vincula a esa persona (no se duplica); si no, se crea.
  - `check_consecutivo`: se valida igual contra la tendencia creciente/decreciente conocida, y si rompe el patrón queda `revisar=true` — igual que un documento leído por OCR, solo que aquí el "error" no es de lectura sino una alerta real para que alguien confirme el número a mano.
  - `build_output_path`: el PDF se organiza en la misma estructura `AAAA/MM/consecutivo_cedula.pdf` (usando la fecha dada, o `sin_fecha` si no se indicó — aquí no hay "período del libro" como respaldo porque no viene de un libro).
- Campos que no se llenaron quedan `NULL`, igual que en el pipeline automático (nunca se inventa un valor de relleno tipo "desconocido" como texto).
- Se guarda `origen='manual'` y `libro_id=NULL`, para poder distinguir después en reportes cuántos documentos entraron por cada vía.
- Requiere rol `editor` o `admin` (subir documentos no es una acción de solo lectura) y queda registrado en `auditoria` como `"subir_documento_manual"`.

**Parámetros de filtro en `GET /documentos`:**

- `consecutivo` (exacto), `consecutivo_desde` / `consecutivo_hasta` (rango numérico)
- `cedula` (exacto)
- `nombre` (contiene, case/acento-insensible)
- `fecha_desde` / `fecha_hasta` (rango de fechas exactas)
- `periodo` (ej. `2024-01`, usa `fecha` o `periodo_libro` como fallback)
- `libro_id`
- `revisar` (bool)
- `motivo_revisar`
- `incluir_eliminados` (bool, default false)
- `q` (búsqueda libre: prueba contra consecutivo, cédula y nombre a la vez)
- `page`, `page_size` (paginación), `orden_por`, `orden` (`asc`/`desc`)

Respuesta paginada estándar:

```json
{
  "total": 4231,
  "page": 1,
  "page_size": 50,
  "resultados": [ { "id": 12, "consecutivo": "47129", "persona": {...}, "fecha": "2024-01-31", "revisar": false, ... } ]
}
```

### 7.2 Personas

| Método | Ruta                          | Descripción                                  |
|--------|-------------------------------|-------------------------------------------------|
| GET    | `/personas`                   | Listar/buscar por cédula o nombre (parcial)     |
| GET    | `/personas/{id}`              | Detalle                                          |
| GET    | `/personas/{id}/documentos`   | Todos los documentos de esa persona              |

### 7.3 Libros (origen)

| Método | Ruta                     | Descripción                                                |
|--------|--------------------------|----------------------------------------------------------------|
| GET    | `/libros`                | Listar libros procesados, con resumen (total docs, período, estado) |
| GET    | `/libros/{id}`           | Detalle                                                          |
| GET    | `/libros/{id}/documentos`| Documentos de ese libro                                          |
| POST   | `/libros`                | Subir un PDF nuevo → crea el job de procesamiento (ver sección 8) |
| GET    | `/libros/{id}/estado`    | Progreso del job (`pendiente/procesando/completado/error`, % avance) |
| POST   | `/libros/{id}/reanudar`  | Reintenta un libro en `estado='error'` desde la última página importada (admin) |

### 7.4 Reportes / panel

| Método | Ruta                     | Descripción                                                        |
|--------|--------------------------|------------------------------------------------------------------------|
| GET    | `/reportes/resumen`      | Totales: documentos por mes, pendientes de revisar, personas sin cédula, libros con errores |

### 7.5 Autenticación

| Método | Ruta              | Descripción                          |
|--------|-------------------|----------------------------------------|
| POST   | `/auth/login`      | Devuelve JWT                            |
| POST   | `/auth/logout`     | Invalida el token (si se maneja blacklist) |

### 7.6 Infraestructura

| Método | Ruta       | Descripción                            |
|--------|------------|-------------------------------------------|
| GET    | `/health`  | Estado de la API y conexión a la base de datos |

### 7.7 Errores

Formato estándar de error para toda la API:

```json
{ "error": "documento_no_encontrado", "mensaje": "No existe el documento con id 999", "detalle": null }
```

Códigos HTTP consistentes: `400` validación, `401` sin autenticar, `403` sin permiso, `404` no existe, `409` conflicto (ej. cédula duplicada en una corrección manual), `422` error de negocio, `500` error interno.

---

## 8. Procesamiento asíncrono de libros nuevos

El OCR de un PDF grande tarda minutos/horas — no puede ser una llamada HTTP síncrona.

Implementado en `api/src/libros/jobs/procesar-libro.job.ts`:

1. `POST /libros` guarda el PDF grande de origen (vía la interfaz `Storage`, en `_libros_origen/`, separado de `output/AAAA/MM` que es donde van los documentos ya separados), crea una fila en `libros` con `estado='pendiente'` (calculando `total_paginas` con `pdf-lib` al vuelo) y dispara el job **sin awaitearlo** (`void this.job.ejecutar(...)`), para no bloquear la respuesta HTTP.
2. El job corre `split_consecutivos.py` tal cual (sin reescribirlo, ver sección 2) como proceso hijo vía `child_process.spawn`, actualizando `libros.estado='procesando'`. El script Python sigue escribiendo cada documento de inmediato en **su propia** sqlite (`split_facturas/documentos.db`), sin cambios.
3. Cuando el proceso termina, el job **importa** las filas nuevas de esa sqlite hacia el schema de Prisma: resuelve/crea la persona por cédula (mismo `getOrCreatePersona` que usa la carga manual), calcula hash/tamaño del PDF ya escrito en disco, e infiere `motivo_revisar`. Actualiza `libros.documentos_generados`, `consecutivo_min/max` y `estado='completado'`.
4. `GET /libros/{id}/estado` permite consultar el progreso desde el cliente (polling simple es suficiente, no hace falta websockets para esto).
5. **Decisión de simplicidad (distinta de la sugerencia original de RQ/Celery):** al ser un solo usuario en una sola PC, el job corre in-process (una promesa async en el propio proceso de Node), sin cola externa ni Redis. Es la opción más simple que cumple el requisito de "no bloquear la respuesta HTTP" a esta escala; si algún día hay varios workers o varias máquinas, ahí sí se justifica introducir BullMQ (equivalente Node de RQ) — no antes.
6. Manejo de errores: si el job falla a mitad de camino, el import de lo ya escrito se intenta igual (try/catch alrededor de la importación en el `catch` del proceso), y el libro queda en `estado='error'` con el detalle en `error_detalle`, pero **los documentos ya guardados hasta ese punto permanecen válidos**. `POST /libros/{id}/reanudar` (admin) recalcula la última página procesada (`MAX(pagina_fin)` de los documentos ya importados de ese libro) y vuelve a correr el script con `--start-page` desde ahí.

---

## 9. Autenticación, autorización y seguridad

- JWT para autenticación (`/auth/login`).
- Roles mínimos: `lector` (solo `GET`), `editor` (puede corregir documentos vía `PATCH`), `admin` (puede subir libros, eliminar, gestionar usuarios).
- Todo endpoint que exponga PDFs o datos de personas requiere autenticación — nada de la API pública sin token, porque los documentos contienen cédulas y nombres reales.
- Descargas de archivo (`/documentos/{id}/archivo`) quedan registradas en `auditoria` (quién descargó qué y cuándo).
- Rate limiting básico en endpoints de login y de descarga masiva, para evitar scraping de datos personales.
- CORS configurado explícitamente para los orígenes del futuro frontend, no `*`.

---

## 10. Calidad de datos y cola de revisión manual

Esta es la parte que conecta con todo lo que ya se resolvió en el pipeline (cédula/nombre nulos, consecutivo fuera de tendencia, fecha aproximada):

- `GET /documentos?revisar=true` es la "bandeja de entrada" de cosas por confirmar.
- `motivo_revisar` permite filtrar por tipo de problema (sin cédula, consecutivo repetido, etc.) para que alguien pueda trabajar por lotes (ej. "hoy reviso todos los que no tienen cédula").
- `PATCH /documentos/{id}` es la única forma de corregir estos datos, y:
  - Si se corrige la cédula y esa cédula ya existe en `personas`, se reusa esa persona (no se duplica) — mismo criterio que ya aplica `get_or_create_persona`.
  - Toda corrección manual queda en `auditoria` con el valor anterior y el nuevo (para poder revertir si alguien se equivoca).
  - Al corregir, `revisar` pasa a `false` y `motivo_revisar` a `"corregido_manual"` (para saber que no fue el pipeline el que lo resolvió).

---

## 11. Consideraciones legales (datos personales)

El sistema guarda cédulas y nombres reales de personas — en Colombia esto cae bajo la **Ley 1581 de 2012 (Habeas Data)**. Puntos a tener en cuenta en el diseño, no como funcionalidad de "fase 1" pero sí como algo a no bloquear con decisiones tempranas equivocadas:

- Registrar en `auditoria` todo acceso de lectura/descarga a documentos con datos personales (ya contemplado arriba).
- Definir política de retención (¿por cuánto tiempo se guardan los PDFs y los datos?) antes de que el volumen crezca demasiado para decidirlo cómodamente.
- Si el sistema alguna vez se expone fuera de la red interna, cifrado en tránsito (HTTPS) es obligatorio, y vale la pena evaluar cifrado en reposo del storage de PDFs.
- Restringir por rol quién puede ver el nombre/cédula completos vs. solo un identificador interno, si el caso de uso lo amerita.

---

## 12. Observabilidad

- Logs estructurados (JSON) por request: usuario, endpoint, tiempo de respuesta, código de estado.
- Métrica básica de negocio expuesta en `/reportes/resumen` (no hace falta Prometheus/Grafana desde el día uno, pero dejar los números calculados y listos para conectar después).
- `/health` verifica conexión a base de datos y a storage, para poder monitorear desde afuera.

---

## 13. Testing

- Los `repositories/` se prueban contra **ambos** motores (SQLite en memoria para tests rápidos, y un MySQL de test vía Docker en CI) para detectar temprano cualquier cosa que funcione en uno y no en el otro (tipos de datos, collation, etc. — ver sección 5).
- Tests de integración de los endpoints principales: buscar con cada filtro, descargar archivo, corregir un documento, subir un libro pequeño de prueba.
- Fixture de un PDF pequeño (2-3 páginas) para no depender del archivo real de 242 MB en los tests automáticos.

---

## 14. Estructura de carpetas propuesta

Árbol real (ya implementado para las fases 0-2; ver sección 15 para lo pendiente):

```
Gestion documental/
├── api/                          # Node + TypeScript + NestJS + Prisma
│   ├── src/
│   │   ├── main.ts               # bootstrap, Swagger, CORS, filtro global de errores
│   │   ├── app.module.ts
│   │   ├── config/
│   │   │   └── configuration.ts  # lee las env vars (seccion 16)
│   │   ├── prisma/
│   │   │   ├── prisma.module.ts
│   │   │   └── prisma.service.ts
│   │   ├── storage/
│   │   │   ├── storage.interface.ts   # interfaz Storage
│   │   │   ├── filesystem-storage.service.ts
│   │   │   └── storage.module.ts
│   │   ├── auth/                 # JWT + guard de roles
│   │   ├── auditoria/            # AuditoriaService (tabla auditoria)
│   │   ├── documentos/
│   │   │   ├── documentos.controller.ts
│   │   │   ├── documentos.service.ts     # check_consecutivo, build_output_path, etc.
│   │   │   ├── documentos.repository.ts
│   │   │   └── dto/
│   │   ├── personas/
│   │   ├── libros/
│   │   │   ├── libros.controller.ts
│   │   │   ├── libros.service.ts
│   │   │   ├── libros.repository.ts
│   │   │   └── jobs/
│   │   │       ├── procesar-libro.job.ts   # spawn del script Python + import
│   │   │       └── ocr-sqlite.client.ts    # lectura de la sqlite de Python
│   │   ├── reportes/
│   │   └── health/
│   ├── scripts/
│   │   ├── crear-usuario.ts      # crea el primer usuario (no hay endpoint de registro)
│   │   └── migrar-desde-python.ts # migra documentos.db (Python) -> schema Prisma
│   ├── prisma/
│   │   ├── schema.prisma         # unica fuente de verdad del esquema (seccion 4)
│   │   └── migrations/
│   └── .env.example
├── split_facturas/               # pipeline OCR en Python, intacto (ver seccion 2)
│   ├── split_consecutivos.py
│   └── documentos.db
└── PLAN_API.md                   # este archivo
```

---

## 15. Roadmap por fases

**Fase 0 — Fundación:**
- [x] Modelos Prisma (`api/prisma/schema.prisma`) — equivalente a SQLAlchemy+Alembic, ver sección 5.
- [x] `fecha` como `DateTime` real y no TEXT en el schema nuevo (la conversión ocurre al importar, ver sección 8).
- [x] Tabla `libros` + `api/scripts/migrar-desde-python.ts` para migrar los datos existentes de `pdf_origen` (texto) a la nueva relación — **script listo, no corrido todavía** contra los datos reales (queda a decisión del usuario, ver nota abajo).

**Fase 1 — API de solo lectura (MVP):**
- [x] `GET /documentos` con todos los filtros.
- [x] `GET /documentos/{id}` y `GET /documentos/{id}/archivo`.
- [x] `GET /personas`, `GET /personas/{id}/documentos`.
- [x] `GET /libros`, `GET /libros/{id}`.
- [x] `GET /health`.

**Fase 2 — Escritura y calidad de datos:**
- [x] Autenticación (JWT) + roles (`api/scripts/crear-usuario.ts` crea el primer usuario, no hay endpoint de registro).
- [x] `PATCH /documentos/{id}` (corrección manual) + `auditoria`.
- [x] `POST /documentos` (carga manual de un documento suelto, ver 7.1.1) reutilizando `getOrCreatePersona`/`chequearConsecutivo`/`construirRutaArchivo`.
- [x] `DELETE /documentos/{id}` (soft delete).
- [x] Endpoints de consecutivos (`/consecutivos`, `/consecutivos/huecos`).

**Fase 3 — Ingesta desde la API:**
- [x] `POST /libros` + job asíncrono in-process (no RQ/Celery — ver la decisión de simplicidad en sección 8; se revisita solo si algún día hay más de una máquina/worker).
- [x] `GET /libros/{id}/estado`.
- [x] `POST /libros/{id}/reanudar` — reanuda un libro en `estado='error'`.
- [ ] Probar el flujo completo `POST /libros` con un PDF real (solo se probó `POST /documentos` manual end-to-end; falta correr el job contra `split_consecutivos.py` con Tesseract real).

**Fase 4 — Producción:**
- [ ] Migrar de SQLite a MySQL (checklist de la sección 5.7).
- [ ] Storage fuera de la carpeta sincronizada con OneDrive.
- [ ] Observabilidad básica + rate limiting + CORS ajustado (hoy CORS solo habilita `localhost:5173` para un futuro frontend dev).
- [ ] Tests automatizados (sección 13) — todavía no escritos, la verificación de esta fase se hizo manualmente (build + smoke tests por curl).

> Nota sobre los datos reales: `split_facturas/documentos.db` ya tiene datos procesados (un libro real de 242 MB). `api/scripts/migrar-desde-python.ts` está listo para importarlos al schema nuevo, pero **no se corrió** en esta sesión — se decidió no tocar datos de producción sin que el usuario lo pida explícitamente. Correrlo es un solo comando: `cd api && npx ts-node scripts/migrar-desde-python.ts`.

---

## 16. Configuración (variables de entorno)

Ver `api/.env.example` (la fuente real). Se carga con `@nestjs/config`:

| Variable          | Ejemplo dev                        | Ejemplo prod                                |
|-------------------|-------------------------------------|-----------------------------------------------|
| `DATABASE_URL`    | `file:./dev.db`                     | `mysql://user:pass@host:3306/gestion_doc`     |
| `STORAGE_BACKEND` | `filesystem`                        | `filesystem` o `s3`                            |
| `STORAGE_PATH`    | `../split_facturas/output`          | ruta fuera de OneDrive                         |
| `JWT_SECRET`      | valor de prueba                     | secreto real, fuera del repo                   |
| `JWT_EXPIRA_MIN`  | `60`                                 | según política                                 |
| `LOG_LEVEL`       | `debug`                             | `info`                                          |
| `PORT`            | `3000`                              | según despliegue                               |
| `PYTHON_BIN`      | `python`                            | ruta al interprete si no está en PATH          |
| `OCR_SCRIPT_PATH` | `../split_facturas/split_consecutivos.py` | igual (el script no se mueve)             |
| `OCR_DB_PATH`     | `../split_facturas/documentos.db`   | igual                                          |

---

## 17. Resumen de decisiones clave

- **Stack: Node.js + TypeScript + NestJS + Prisma.** Se evaluó Python/FastAPI primero (coherente con el pipeline OCR), pero el usuario se siente más cómodo en Node y el análisis de esfuerzo mostró que no hay bloqueo real: NestJS reproduce la misma arquitectura por capas (controllers/services/repositories ≈ routers/services/repositories), Prisma cubre el rol de SQLAlchemy+Alembic con el mismo principio ("un schema, cambia el `DATABASE_URL`"), y `@nestjs/swagger` da documentación OpenAPI automática igual que FastAPI.
- **El pipeline OCR (`split_consecutivos.py`) NO se reescribió en Node — se mantiene intacto en Python.** Es la decisión más importante de este cambio de stack: reescribir el OCR no daba ninguna ventaja (la lógica de voto por mayoría y detección de tendencia ya funciona) y sí arriesgaba introducir bugs sutiles. La API en Node lo corre como proceso hijo (igual que ya se hace con Tesseract/Poppler) y **importa** sus resultados hacia el schema de Prisma después de cada corrida — no comparten ORM ni proceso, comparten un contrato de importación (ver sección 2 y 8).
- **Single-usuario, PC local: sin hosting, sin Docker, sin cola externa.** La API corre con `uvicorn`-equivalente (`node dist/main.js`) en `localhost`, SQLite como base, PDFs en filesystem fuera de OneDrive. El job de libros es in-process (sin Redis/BullMQ) porque no hay más de un worker que coordinar a esta escala. Migrar a red local es cambiar el host de binding; migrar a MySQL es cambiar `DATABASE_URL` — ambas rutas quedan abiertas sin rediseñar nada (sección 5).
- **La portabilidad SQLite → MySQL se gana en el diseño del schema de Prisma, no en un migrador mágico al final.** Tipos correctos desde el día uno.
- **La cola de revisión (`revisar` + `motivo_revisar`) es tan importante como la búsqueda** — es lo que conecta el trabajo ya hecho en el OCR (detectar cuándo algo no se pudo leer bien) con una acción humana concreta en el sistema.
