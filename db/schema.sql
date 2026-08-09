-- ============================================================================
--  SISTEMA DE GESTIÓN DE LICENCIAS - COLEGIO
--  Script DDL para PostgreSQL 13+
--  Ejecutar como superusuario o rol con permisos CREATE en la BD destino.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. Extensiones
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid(), crypto
CREATE EXTENSION IF NOT EXISTS "citext";      -- comparacion case-insensitive de emails

-- ----------------------------------------------------------------------------
-- 1. Tipos ENUM (reutilizables y tipados a nivel BD)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE role_name   AS ENUM ('admin', 'revisor', 'solicitante');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE applicant_kind AS ENUM ('student', 'guardian', 'staff');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE request_type AS ENUM ('medical', 'personal', 'calamidad_domestica', 'institutional', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE request_status AS ENUM ('pending', 'pre_approved', 'approved', 'rejected', 'info_required', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE attachment_kind AS ENUM ('evidence', 'receipt', 'qr_code', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE audit_action AS ENUM (
        'create', 'update', 'delete',
        'approve', 'pre_approve', 'reject', 'request_info',
        'login', 'logout', 'role_change', 'restore'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----------------------------------------------------------------------------
-- 2. Tabla: roles
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        role_name NOT NULL UNIQUE,
    description TEXT
);

-- Semilla inicial de roles
INSERT INTO roles (name, description) VALUES
    ('admin',       'Direccion / Inspectoria - control total'),
    ('revisor',     'Tutor / Profesor jefe - pre-dictamen por curso/area'),
    ('solicitante', 'Estudiante / Apoderado / Personal - crea y consulta sus solicitudes')
ON CONFLICT (name) DO NOTHING;

-- ----------------------------------------------------------------------------
-- 3. Tabla: users
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name          TEXT NOT NULL CHECK (length(btrim(name)) >= 3),
    email         CITEXT NOT NULL UNIQUE CHECK (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
    password_hash TEXT NOT NULL,
    role_id       SMALLINT NOT NULL REFERENCES roles(id) ON UPDATE CASCADE,
    status        user_status NOT NULL DEFAULT 'active',
    phone         TEXT CHECK (phone ~ '^\+?[0-9\-\s]{6,20}$'),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_users_role   ON users(role_id);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- ----------------------------------------------------------------------------
-- 4. Tabla: courses  (cursos/secciones gestionados por revisores)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS courses (
    id          SMALLINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,         -- p.ej. "1ro Secundaria A"
    level       TEXT,                          -- primaria / secundaria
    school_year TEXT
);

-- ----------------------------------------------------------------------------
-- 5. Tabla: course_reviewers  (asignacion revisor <-> curso, N:M)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS course_reviewers (
    course_id   SMALLINT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    reviewer_id UUID     NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (course_id, reviewer_id)
);

-- ----------------------------------------------------------------------------
-- 6. Tabla: students  (perfil de estudiante, opcional segun solicitante)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS students (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    ru_code      TEXT UNIQUE,                    -- RUDE / codigo interno
    course_id    SMALLINT REFERENCES courses(id) ON DELETE SET NULL,
    status       user_status NOT NULL DEFAULT 'active',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_students_course ON students(course_id);
CREATE INDEX IF NOT EXISTS idx_students_user   ON students(user_id);

-- ----------------------------------------------------------------------------
-- 7. Tabla: guardians  (perfil de padre/apoderado)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guardians (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID UNIQUE REFERENCES users(id) ON DELETE SET NULL,
    ci_number  TEXT UNIQUE,                       -- Cedula de identidad
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------------------
-- 8. Tabla: student_guardians  (relacion estudiante <-> tutor, N:M)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS student_guardians (
    student_id   UUID NOT NULL REFERENCES students(id)  ON DELETE CASCADE,
    guardian_id  UUID NOT NULL REFERENCES guardians(id) ON DELETE CASCADE,
    relationship TEXT,                              -- padre / madre / tutor legal
    is_primary   BOOLEAN NOT NULL DEFAULT false,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (student_id, guardian_id)
);

CREATE INDEX IF NOT EXISTS idx_sg_guardian ON student_guardians(guardian_id);

-- ----------------------------------------------------------------------------
-- 9. Tabla: leave_requests  (peticiones de licencia)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leave_requests (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tracking_code   TEXT NOT NULL UNIQUE,                    -- codigo publico de seguimiento
    applicant_id    UUID NOT NULL REFERENCES users(id)      ON DELETE RESTRICT,
    applicant_kind  applicant_kind NOT NULL,
    student_id      UUID REFERENCES students(id)             ON DELETE SET NULL,
    course_id       SMALLINT REFERENCES courses(id)          ON DELETE SET NULL,
    request_type    request_type NOT NULL,
    start_date      TIMESTAMPTZ NOT NULL,
    end_date        TIMESTAMPTZ NOT NULL,
    hours_requested NUMERIC(6,2) GENERATED ALWAYS AS
                    (EXTRACT(EPOCH FROM (end_date - start_date)) / 3600) STORED,
    reason          TEXT NOT NULL CHECK (length(btrim(reason)) >= 10),
    status          request_status NOT NULL DEFAULT 'pending',

    -- Pre-dictamen (revisor / tutor)
    pre_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    pre_review_at   TIMESTAMPTZ,
    pre_review_comment TEXT,

    -- Decision final (admin / direccion)
    reviewed_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at     TIMESTAMPTZ,
    review_comment  TEXT,

    -- Metadatos de auditoria ligera en la fila
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    deleted_at      TIMESTAMPTZ,                             -- soft delete

    -- Restricciones de negocio a nivel BD
    CONSTRAINT chk_lr_dates      CHECK (end_date >= start_date),
    CONSTRAINT chk_lr_status_rev CHECK (
        (status IN ('approved','rejected') AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
        OR (status NOT IN ('approved','rejected'))
    )
);

-- Indices optimizados para filtros del dashboard
CREATE INDEX IF NOT EXISTS idx_lr_status      ON leave_requests(status);
CREATE INDEX IF NOT EXISTS idx_lr_type        ON leave_requests(request_type);
CREATE INDEX IF NOT EXISTS idx_lr_dates       ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_lr_applicant   ON leave_requests(applicant_id);
CREATE INDEX IF NOT EXISTS idx_lr_course      ON leave_requests(course_id);
CREATE INDEX IF NOT EXISTS idx_lr_created     ON leave_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lr_tracking    ON leave_requests(tracking_code);
CREATE INDEX IF NOT EXISTS idx_lr_reviewed_by ON leave_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_lr_pending      ON leave_requests(status, created_at DESC)
    WHERE deleted_at IS NULL;

-- ----------------------------------------------------------------------------
-- 10. Tabla: request_attachments  (evidencias / comprobantes)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS request_attachments (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id    UUID NOT NULL REFERENCES leave_requests(id) ON DELETE CASCADE,
    uploaded_by   UUID NOT NULL REFERENCES users(id)         ON DELETE SET NULL,
    kind          attachment_kind NOT NULL DEFAULT 'evidence',
    storage_path  TEXT NOT NULL,                         -- ruta en S3 / local
    file_url      TEXT NOT NULL,                         -- URL firmada o publica
    file_name     TEXT NOT NULL,
    file_type     TEXT NOT NULL CHECK (file_type IN ('application/pdf','image/jpeg','image/png','image/webp')),
    file_size     BIGINT NOT NULL CHECK (file_size > 0 AND file_size <= 5242880), -- 5 MB
    checksum_sha256 TEXT,
    uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_att_request ON request_attachments(request_id);

-- ----------------------------------------------------------------------------
-- 11. Tabla: audit_logs  (auditoria completa de acciones administrativas)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_id    UUID REFERENCES users(id) ON DELETE SET NULL,
    action      audit_action NOT NULL,
    entity_type TEXT NOT NULL,           -- 'leave_requests', 'users', 'roles'...
    entity_id   TEXT,
    metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
    ip_address  INET,
    user_agent  TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_actor  ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_time   ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_meta_gin ON audit_logs USING GIN (metadata);

-- ============================================================================
--  TRIGGERS  --  mantenimiento automatico de updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_users_updated_at     ON users;
CREATE TRIGGER trg_users_updated_at     BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_students_updated_at ON students;
CREATE TRIGGER trg_students_updated_at BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_guardians_updated_at ON guardians;
CREATE TRIGGER trg_guardians_updated_at BEFORE UPDATE ON guardians
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

DROP TRIGGER IF EXISTS trg_lr_updated_at ON leave_requests;
CREATE TRIGGER trg_lr_updated_at BEFORE UPDATE ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION fn_set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: generar tracking_code automatico al insertar leave_requests
-- Formato: LIC-YYYY-XXXXXXXX  (8 chars base32 aleatorios)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_gen_tracking_code()
RETURNS trigger AS $$
DECLARE
    code TEXT;
BEGIN
    IF NEW.tracking_code IS NULL OR btrim(NEW.tracking_code) = '' THEN
        LOOP
            code := 'LIC-' || to_char(now(),'YYYY') || '-' ||
                    upper(encode(gen_random_bytes(5),'base64'));
            -- limpiar caracteres no alfanumericos
            code := regexp_replace(code, '[^A-Z0-9-]', '', 'g');
            EXIT WHEN NOT EXISTS (
                SELECT 1 FROM leave_requests WHERE tracking_code = code
            );
        END LOOP;
        NEW.tracking_code := code;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_lr_tracking_code ON leave_requests;
CREATE TRIGGER trg_lr_tracking_code BEFORE INSERT ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION fn_gen_tracking_code();

-- ----------------------------------------------------------------------------
-- Trigger: auditoria automatica de cambios de estado en leave_requests
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION fn_audit_leave_request()
RETURNS trigger AS $$
DECLARE
    act audit_action;
BEGIN
    IF (TG_OP = 'INSERT') THEN
        act := 'create';
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
        VALUES (NULL, 'delete', 'leave_requests', OLD.id::text,
                jsonb_build_object('tracking_code', OLD.tracking_code));
        RETURN OLD;
    ELSIF (TG_OP = 'UPDATE') THEN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
            CASE NEW.status
                WHEN 'pre_approved'  THEN act := 'pre_approve';
                WHEN 'approved'      THEN act := 'approve';
                WHEN 'rejected'      THEN act := 'reject';
                WHEN 'info_required' THEN act := 'request_info';
                ELSE act := 'update';
            END CASE;
            INSERT INTO audit_logs(actor_id, action, entity_type, entity_id, metadata)
            VALUES (
                COALESCE(NEW.reviewed_by, NEW.pre_reviewed_by),
                act,
                'leave_requests',
                NEW.id::text,
                jsonb_build_object(
                    'from', OLD.status,
                    'to',   NEW.status,
                    'comment', COALESCE(NEW.review_comment, NEW.pre_review_comment)
                )
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_leave_request ON leave_requests;
CREATE TRIGGER trg_audit_leave_request
    AFTER INSERT OR DELETE OR UPDATE OF status ON leave_requests
    FOR EACH ROW EXECUTE FUNCTION fn_audit_leave_request();

-- ============================================================================
--  VISTAS DE CONVENIENCIA
-- ============================================================================

-- Vista: dashboard de solicitudes pendientes para revisores de un curso
CREATE OR REPLACE VIEW v_pending_by_course AS
SELECT
    lr.id,
    lr.tracking_code,
    lr.applicant_kind,
    u.name            AS applicant_name,
    u.email           AS applicant_email,
    c.name            AS course_name,
    lr.request_type,
    lr.start_date,
    lr.end_date,
    lr.hours_requested,
    lr.status,
    lr.created_at
FROM leave_requests lr
JOIN users u        ON u.id = lr.applicant_id
LEFT JOIN courses c ON c.id = lr.course_id
WHERE lr.deleted_at IS NULL
  AND lr.status IN ('pending','pre_approved','info_required');

-- ============================================================================
--  DATOS SEMILLA / DEMO  (opcional - comentar en produccion)
-- ============================================================================
INSERT INTO users (name, email, password_hash, role_id, phone) VALUES
    ('Administrador Colegio', 'admin@colegio.edu', crypt('admin123', gen_salt('bf')), 1, '+591-70000000'),
    ('Tutor 1ro A',          'tutor@colegio.edu',  crypt('tutor123',  gen_salt('bf')), 2, '+591-70000001'),
    ('Juan Perez Estudiante', 'juan@colegio.edu',   crypt('juan123',   gen_salt('bf')), 3, '+591-70000002')
ON CONFLICT (email) DO NOTHING;

-- ============================================================================
--  FIN DEL SCRIPT
-- ============================================================================
