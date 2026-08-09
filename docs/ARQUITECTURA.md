# Sistema de Gestión de Licencias — Colegio

Arquitectura completa de una aplicación web para la gestión de solicitudes de permisos/ausencias con portal institucional público y panel administrativo RBAC, sobre PostgreSQL.

---

## 1. Diagrama ER (descripción textual estructurada)

```
                         ┌──────────────────┐
                         │      roles       │
                         │ id (SMALLINT PK) │
                         │ name  (ENUM UQ)  │
                         │ description      │
                         └────────┬─────────┘
                                  │ 1..N
                         ┌────────▼─────────┐
                         │      users        │
                         │ id (UUID PK)     │◄─────────────────────────────────┐
                         │ name, email(UQ)  │                                  │
                         │ password_hash    │                                  │
                         │ role_id (FK)     │                                  │
                         │ status, phone    │                                  │
                         │ created/updated  │                                  │
                         └──┬──────────┬────┘                                  │
        ┌──────────────────┘          └────────────────────────┐              │
        │ 1..1                                                    │              │
┌───────▼────────┐                                          ┌────▼───────────┐ │
│   students     │◄──────┐                                  │   guardians    │ │
│ id (UUID PK)   │  N..N │                                  │ id (UUID PK)   │ │
│ user_id (FK)   │       │                                  │ user_id (FK)   │ │
│ ru_code (UQ)   │       │                                  │ ci_number (UQ) │ │
│ course_id (FK) │       │                                  └───────┬────────┘ │
└───┬────────────┘       │                                          │          │
    │                    │  student_guardians                        │          │
    │ N..N               │  ┌────────────────────┐                    │          │
    │                    └──│ student_id (PK,FK) │◄─────┐             │          │
    │                       │ guardian_id(PK,FK) │─────┘ (N..N)───┘             │
    │                       │ relationship       │                               │
    │                       └────────────────────┘                               │
    │                                                                          │
    │               ┌──────────────────┐                                      │
    │               │     courses       │                                      │
    └──────────────►│ id (SMALLINT PK)  │◄──┐                                  │
                    │ name (UQ)         │   │ N..N                              │
                    │ level, year       │   │ course_reviewers                 │
                    └──────────────────┘   │ ┌───────────────────┐              │
                                           └─│ course_id (PK,FK) │              │
                                             │ reviewer_id(PK,FK)├──────► users  │
                                             └───────────────────┘              │

  ┌──────────────────────────────┐         ┌──────────────────────────────────┐
  │       leave_requests         │         │       request_attachments        │
  │ id (UUID PK)                 │ 1..N    │ id (UUID PK)                      │
  │ tracking_code (UQ)           ├────────►│ request_id (FK)                   │
  │ applicant_id (FK)            │         │ uploaded_by (FK)                  │
  │ applicant_kind (ENUM)        │         │ kind (ENUM)                       │
  │ student_id (FK, NULL)        │         │ storage_path, file_url            │
  │ course_id (FK, NULL)         │         │ file_name, file_type, file_size   │
  │ request_type (ENUM)          │         │ checksum_sha256                   │
  │ start_date, end_date         │         │ uploaded_at                       │
  │ hours_requested (GENERATED)  │         └──────────────────────────────────┘
  │ reason (TEXT)                │
  │ status (ENUM)                │         ┌──────────────────────────────────┐
  │ pre_reviewed_by (FK)         │         │          audit_logs              │
  │ pre_review_at                │         │ id (BIGINT PK)                   │
  │ pre_review_comment           │         │ actor_id (FK)                    │
  │ reviewed_by (FK)             │         │ action (ENUM)                    │
  │ reviewed_at                  │         │ entity_type, entity_id           │
  │ review_comment               │         │ metadata (JSONB)                 │
  │ created_at / updated_at      │         │ ip_address, user_agent            │
  │ deleted_at (soft delete)     │         │ created_at                       │
  └──────────────────────────────┘         └──────────────────────────────────┘
```

### Relaciones clave

| Origen | Destino | Cardinalidad | Tipo |
|---|---|---|---|
| `users` → `roles` | N:1 | cada usuario tiene 1 rol |
| `students` → `users` | 1:1 | perfil estudiante opcional |
| `guardians` → `users` | 1:1 | perfil apoderado opcional |
| `student_guardians` (student / guardian) | N:M | puente |
| `course_reviewers` (course / reviewer) | N:M | reviewer ↔ curso |
| `leave_requests` → `users` (applicant) | N:1 | solicitante |
| `leave_requests` → `users` (reviewed_by) | N:1 | aprobador final |
| `request_attachments` → `leave_requests` | N:1 | evidencias |
| `audit_logs` → `users` (actor) | N:1 | trazabilidad |

---

## 2. Esquema PostgreSQL

Script DDL completo y auto-ejecutable en `db/schema.sql` (PostgreSQL 13+). Incluye:

- **PKs UUID** vía `pgcrypto` (`gen_random_uuid()`).
- **FKs** con políticas `ON DELETE` explícitas (CASCADE / SET NULL / RESTRICT).
- **CHECKs**: validación de email, fechas (`end_date >= start_date`), tamaño y tipo de archivo (5 MB, PDF/JPG/PNG/WebP), longitud mínima de `reason`, y consistencia entre `status` y `reviewed_by`.
- **ENUMs** tipados a nivel BD (`role_name`, `request_type`, `request_status`, `audit_action`, …) evitando "magic strings".
- **Índices**: en `status`, `request_type`, rango de fechas, `applicant_id`, `course_id`, `tracking_code`, `created_at DESC`, y un **partial index** en `WHERE deleted_at IS NULL` para listados activos. Índice GIN sobre `audit_logs.metadata` (JSONB).
- **Triggers**:
  - `updated_at` automático en todas las tablas con timestamps.
  - Generación de `tracking_code` único (formato `LIC-YYYY-XXXXXXXX`) al insertar.
  - **Auditoría automática**: inserta en `audit_logs` cuando cambia el `status` de una solicitud (`approve`, `reject`, `request_info`, `pre_approve`).
- **Columna generada** `hours_requested` (calculada de `end_date - start_date`).
- **Vista** `v_pending_by_course` para alimentar el dashboard.
- **Semilla** de roles y usuarios demo (contraseñas con `crypt()` + `gen_salt('bf')`).

---

## 3. Arquitectura técnica

### 3.1 Stack propuesto

| Capa | Tecnología | Justificación |
|---|---|---|
| **Frontend** | React 19 + Vite + TailwindCSS | Proyecto existente en este repo. SPA rápida, build estático. |
| **Routing/Estado** | React Router + TanStack Query | Cache de solicitudes, invalidación tras decisión, optimistic UI. |
| **Backend (API)** | Node.js + Fastify + TypeScript | Rendimiento, tipado, esquemas Zod para validación. |
| **ORM** | Prisma | Migración versionable, tipado end-to-end con el cliente generado desde el esquema. |
| **BD** | PostgreSQL 13+ (este `schema.sql`) | Integridad referencial, ENUMs, JSONB, partial indexes, triggers. |
| **Auth** | JWT (access + refresh) + bcrypt | Stateless, escalable. Refresh tokens en tabla `refresh_tokens`. |
| **Carga de archivos** | S3 (o MinIO local) + Presigned URLs | El backend firma URLs y el navegador sube directo a S3. |
| **PDF / QR** | `pdfkit` + `qrcode` (Node) | Generación de comprobante firmado al aprobar. |
| **Contenedores** | Docker Compose: `api`, `web`, `db`, `minio` | Reproducible; un solo `docker-compose up`. |
| **Reverse proxy / TLS** | Caddy o Nginx | HTTPS automático. |
| **Observabilidad** | pino (logs) + Sentry + Prometheus/Grafana | Trazabilidad y métricas. |

### 3.2 Diagrama de componentes

```
                ┌─────────────────── Public (portal institucional) ─────────────────┐
                │  noticias · info general · FAQ · acceso a licencias             │
                └──────────────────────────────────────────────────────────────── ┘
                  │ HTTPS / Nginx
       ┌──────────▼──────────┐         ┌──────────────────────┐
       │  Frontend (React+Vite)│         │   Servidor archivos   │
       │   CSR / static build  │         │   S3 / MinIO (signed) │
       └──────────┬───────────┘         └──────────▲───────────┘
                  │ REST + JWT                       │ presigned PUT/GET
       ┌──────────▼───────────────────────────────────┐
       │  Backend (Fastify + TS + Prisma)              │
       │  • /auth       login/refresh/logout            │
       │  • /leave-requests   CRUD, status, revisión     │
       │  • /upload (presign)  • /receipts/:id/pdf       │
       │  • /admin/users   RBAC  • /audit            RBAC │
       └──────────┬───────────────────────────────────────┘
                  │ Prisma Client (pool pg)
       ┌──────────▼───────────┐
       │  PostgreSQL 13+       │  ← schema.sql, triggers, vista, índices
       └──────────────────────┘
```

### 3.3 RBAC y flujo de aprobación

| Rol | Permisos clave | Acciones en `leave_requests.status` |
|---|---|---|
| `solicitante` | Crear, consultar las suyas por `tracking_code` o sesión | `cancelled` |
| `revisor` | Ver de su curso/aera; ver evidencia; **pre-dictamen** | `pending → pre_approved` \| `info_required` |
| `admin` | Acceso total; gestión de usuarios/roles; decisión final; logs | `* → approved` \| `rejected` \| `info_required` |

Flujo:
1. Solicitante crea y sube evidencia → `pending`.
2. Revisor del curso emite pre-dictamen → `pre_approved` o `info_required`.
3. Admin toma la decisión final → `approved` (se genera PDF con QR) o `rejected` (motivo obligatorio en `review_comment`).
4. Cada cambio de estado dispara el trigger de auditoría (`audit_logs`).

### 3.4 Seguridad recomendada

- **RLS (Row Level Security)** opcional para aislar por `applicant_id`/`course_id`.
- **Rate limiting** en `/auth/login` y `/leave-requests`.
- **Solo subidas presigned** con 15 min de TTL y `Content-Type` restringido.
- **Parámetros prepared** en Prisma para evitar SQLi; **CABECERAS Helmet**.
- **Soft delete** (`deleted_at`) en `leave_requests`; auditoría en `audit_logs` es **append-only** (proteger contra `UPDATE`/`DELETE` por rol).

---

## 4. Panel de revisión (implementación)

Incluido en este repositorio (`src/`):

- `src/api/leaveRequests.js` — capa de acceso (simulada/injetable con fetch).
- `src/components/` — componentes reutilizables (`StatusBadge`, `LeaveFilterBar`, `LeaveRow`, `EvidencePreview`, `DecisionModal`).
- `src/pages/AdminReviewPanel.jsx` — vista principal con filtros, lista detallada, vista previa de evidencia y modal de decisión (aprobar/rechazar/solicitar corrección).
- Estilos en TailwindCSS conectados desde `src/index.css` sustitutivos del boilerplate original.

Para arrancar:
```bash
npm install
npm run dev
```

> La vista usa mocks históricos en `src/api/leaveRequests.js` para que sea funcional sin backend. Apuntar la variable `VITE_API_URL` para conectarla al backend real.
