-- ============================================================
-- Alumni Portal — initial schema
-- Postgres 15+
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

-- Where a person sits in their lifecycle. One person, one row,
-- status transitions. Students become alumni via annual rollover.
CREATE TYPE member_status AS ENUM (
  'unclaimed',        -- seeded from college records, never logged in
  'invited',          -- outreach sent
  'pending',          -- claimed, awaiting verification
  'active_student',   -- verified, currently enrolled
  'active_alumni',    -- verified, graduated
  'rejected',
  'lapsed',           -- dormant / bounced / opted out
  'deceased'          -- suppress all outreach, retain record
);

-- What a person is allowed to do. Additive and independent of status:
-- an alumnus can also be faculty and an HOD.
CREATE TYPE member_role AS ENUM (
  'student',
  'alumni',
  'faculty',
  'alumni_cell_operator',
  'placement_officer',
  'hod',
  'finance',
  'college_admin',
  'platform_admin'
);

CREATE TYPE verification_method AS ENUM (
  'auto_roll_match',      -- exact match against degree_register
  'admin_manual',
  'hod_manual',
  'bulk_import',          -- legacy migration, consent on first sign-in
  'placement_cell_import' -- student roster
);

CREATE TYPE connection_state AS ENUM (
  'pending', 'accepted', 'declined', 'expired', 'withdrawn', 'blocked'
);

CREATE TYPE connection_kind AS ENUM (
  'mentorship', 'referral', 'introduction', 'speaking'
);

CREATE TYPE job_state AS ENUM ('draft', 'pending_moderation', 'live', 'rejected', 'closed');

CREATE TYPE donation_state AS ENUM ('initiated', 'succeeded', 'failed', 'refunded');

CREATE TYPE contact_visibility AS ENUM (
  'private',        -- owner + admins only
  'on_accept',      -- released when a connection request is accepted
  'alumni_only',
  'all_members'
);

-- ------------------------------------------------------------
-- Tenancy
-- ------------------------------------------------------------

CREATE TABLE tenants (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  short_name    text NOT NULL,
  subdomain     text NOT NULL UNIQUE,
  established   int,
  fcra_registered boolean NOT NULL DEFAULT false,
  fcra_number   text,
  reg_80g       text,
  settings      jsonb NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE departments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  code        text NOT NULL,          -- CSE, ECE, EEE, MECH, CIVIL, IT
  name        text NOT NULL,
  UNIQUE (tenant_id, code)
);

-- ------------------------------------------------------------
-- Degree register — the college's authoritative record.
-- Loaded from the examinations branch. Exists for every graduate
-- whether or not they ever sign up. Verification is a match
-- between this table and a self-registration.
-- ------------------------------------------------------------

CREATE TABLE degree_register (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  roll_number      text NOT NULL,
  name             text NOT NULL,
  name_normalised  text GENERATED ALWAYS AS (lower(regexp_replace(name, '[^a-zA-Z]', '', 'g'))) STORED,
  department_id    uuid REFERENCES departments(id),
  programme        text,                -- B.Tech, M.Tech, MBA
  admission_year   int,
  year_of_passing  int,
  source_file      text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, roll_number)
);

CREATE INDEX idx_degreereg_name_trgm ON degree_register USING gin (name_normalised gin_trgm_ops);
CREATE INDEX idx_degreereg_lookup ON degree_register (tenant_id, year_of_passing, department_id);

-- ------------------------------------------------------------
-- Members — one row per person, students and alumni alike.
-- ------------------------------------------------------------

CREATE TABLE members (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,

  roll_number         text,
  status              member_status NOT NULL DEFAULT 'unclaimed',

  full_name           text NOT NULL,
  preferred_name      text,
  photo_url           text,
  bio                 text,

  department_id       uuid REFERENCES departments(id),
  admission_year      int,
  batch_year          int,               -- year of passing
  programme           text,

  -- current professional snapshot (denormalised for directory search)
  current_company     text,
  designation         text,
  industry            text,
  city                text,
  state               text,
  country             text,
  skills              text[] NOT NULL DEFAULT '{}',

  -- availability flags drive the mediated-contact model
  open_to_mentoring   boolean NOT NULL DEFAULT false,
  open_to_referrals   boolean NOT NULL DEFAULT false,
  open_to_speaking    boolean NOT NULL DEFAULT false,

  -- student-only, never exposed to alumni
  cgpa                numeric(4,2),
  placement_status    text,

  verified_at         timestamptz,
  verified_by         uuid,
  verification_method verification_method,
  degree_register_id  uuid REFERENCES degree_register(id),

  legacy_hoopstr_id   text,              -- kept permanently
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),

  UNIQUE (tenant_id, roll_number)
);

CREATE INDEX idx_members_directory ON members (tenant_id, status, batch_year, department_id);
CREATE INDEX idx_members_name_trgm ON members USING gin (full_name gin_trgm_ops);
CREATE INDEX idx_members_company_trgm ON members USING gin (current_company gin_trgm_ops);
CREATE INDEX idx_members_skills ON members USING gin (skills);

-- Contact data lives apart from the profile so that field-level
-- access control is enforced by which table you join, not by
-- remembering to strip columns in every serializer.
CREATE TABLE member_contacts (
  member_id     uuid PRIMARY KEY REFERENCES members(id) ON DELETE CASCADE,
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         citext,
  email_verified boolean NOT NULL DEFAULT false,
  mobile        text,                  -- E.164
  mobile_verified boolean NOT NULL DEFAULT false,
  alt_email     citext,
  linkedin      text,
  github        text,
  portfolio     text,
  address       text,
  visibility    contact_visibility NOT NULL DEFAULT 'on_accept',
  whatsapp_opt_in boolean NOT NULL DEFAULT false,
  email_opt_in    boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_contacts_email ON member_contacts (tenant_id, email) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_contacts_mobile ON member_contacts (tenant_id, mobile) WHERE mobile IS NOT NULL;

CREATE TABLE member_roles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role         member_role NOT NULL,
  department_id uuid REFERENCES departments(id),   -- scopes hod / faculty
  granted_by   uuid REFERENCES members(id),
  granted_at   timestamptz NOT NULL DEFAULT now(),
  revoked_at   timestamptz,
  UNIQUE (member_id, role, department_id)
);

CREATE INDEX idx_member_roles_active ON member_roles (member_id) WHERE revoked_at IS NULL;

-- ------------------------------------------------------------
-- History
-- ------------------------------------------------------------

CREATE TABLE employment_history (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  company     text NOT NULL,
  designation text,
  industry    text,
  location    text,
  started_on  date,
  ended_on    date,
  is_current  boolean NOT NULL DEFAULT false
);

CREATE TABLE education_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  institution   text NOT NULL,
  qualification text,
  field         text,
  started_on    date,
  ended_on      date
);

-- ------------------------------------------------------------
-- Mediated contact — the student-to-alumni valve.
-- Every contact attempt is a row: rate limiting, audit, analytics.
-- ------------------------------------------------------------

CREATE TABLE connection_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  from_member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  to_member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind           connection_kind NOT NULL,
  state          connection_state NOT NULL DEFAULT 'pending',
  message        text,
  responded_at   timestamptz,
  expires_at     timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (from_member_id <> to_member_id)
);

CREATE INDEX idx_conn_inbox ON connection_requests (to_member_id, state, created_at DESC);
CREATE INDEX idx_conn_ratelimit ON connection_requests (from_member_id, created_at DESC);

-- ------------------------------------------------------------
-- Events
-- ------------------------------------------------------------

CREATE TABLE events (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title          text NOT NULL,
  slug           text NOT NULL,
  description    text,
  venue          text,
  starts_at      timestamptz NOT NULL,
  ends_at        timestamptz,
  department_id  uuid REFERENCES departments(id),
  student_eligible boolean NOT NULL DEFAULT false,
  alumni_only    boolean NOT NULL DEFAULT false,
  capacity       int,
  ticket_price   numeric(10,2) NOT NULL DEFAULT 0,
  published      boolean NOT NULL DEFAULT false,
  created_by     uuid REFERENCES members(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE event_registrations (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  guests       int NOT NULL DEFAULT 0,
  amount_paid  numeric(10,2) NOT NULL DEFAULT 0,
  payment_ref  text,
  checked_in_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, member_id)
);

-- ------------------------------------------------------------
-- Jobs — every post moderated before going live
-- ------------------------------------------------------------

CREATE TABLE job_postings (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  posted_by     uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title         text NOT NULL,
  company       text NOT NULL,
  location      text,
  is_internship boolean NOT NULL DEFAULT false,
  description   text,
  apply_url     text,
  state         job_state NOT NULL DEFAULT 'pending_moderation',
  moderated_by  uuid REFERENCES members(id),
  moderated_at  timestamptz,
  closes_on     date,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_jobs_live ON job_postings (tenant_id, state, created_at DESC);

CREATE TABLE job_applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  job_id      uuid NOT NULL REFERENCES job_postings(id) ON DELETE CASCADE,
  member_id   uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, member_id)
);

-- ------------------------------------------------------------
-- Donations — FCRA segregation is structural, not a UI concern
-- ------------------------------------------------------------

CREATE TABLE donation_campaigns (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title       text NOT NULL,
  slug        text NOT NULL,
  description text,
  target      numeric(12,2),
  starts_on   date,
  ends_on     date,
  active      boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES members(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug)
);

CREATE TABLE donations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  campaign_id       uuid REFERENCES donation_campaigns(id),
  member_id         uuid REFERENCES members(id),
  donor_name        text NOT NULL,
  donor_pan         text,
  amount            numeric(12,2) NOT NULL,
  currency          char(3) NOT NULL DEFAULT 'INR',
  source_country    char(2),
  is_foreign_contribution boolean NOT NULL DEFAULT false,
  state             donation_state NOT NULL DEFAULT 'initiated',
  gateway           text,
  gateway_ref       text,
  receipt_80g_no    text,
  reconciled_by     uuid REFERENCES members(id),
  reconciled_at     timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- A campaign's creator must not be its sole reconciler.
ALTER TABLE donations ADD CONSTRAINT chk_reconciler_not_creator
  CHECK (reconciled_by IS NULL OR reconciled_by <> (
    SELECT created_by FROM donation_campaigns c WHERE c.id = campaign_id
  )) NOT VALID;

CREATE INDEX idx_donations_fcra ON donations (tenant_id, is_foreign_contribution, created_at DESC);

-- ------------------------------------------------------------
-- Consent — append-only, the DPDP audit trail
-- ------------------------------------------------------------

CREATE TABLE consent_records (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  purpose      text NOT NULL,          -- directory_listing, email_comms, whatsapp_comms
  notice_version text NOT NULL,
  granted      boolean NOT NULL,
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_consent_member ON consent_records (member_id, purpose, created_at DESC);

CREATE TABLE data_requests (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id    uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  kind         text NOT NULL,          -- export | deletion | correction
  state        text NOT NULL DEFAULT 'received',
  fulfilled_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Audit — every admin mutation, with before/after
-- ------------------------------------------------------------

CREATE TABLE audit_log (
  id           bigserial PRIMARY KEY,
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id     uuid REFERENCES members(id),
  actor_email  text,
  actor_role   member_role,
  action       text NOT NULL,          -- member.approve, alumni.export, job.reject
  resource     text NOT NULL,
  resource_id  text,
  before       jsonb,
  after        jsonb,
  reason       text,
  ip           inet,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_lookup ON audit_log (tenant_id, created_at DESC);
CREATE INDEX idx_audit_actor ON audit_log (actor_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_log (tenant_id, action, created_at DESC);

-- ------------------------------------------------------------
-- Row-level security. Tenant isolation belongs here, not in
-- application code — one forgotten WHERE clause is a cross-college
-- data leak.
-- ------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'departments','degree_register','members','member_contacts','member_roles',
    'employment_history','education_history','connection_requests','events',
    'event_registrations','job_postings','job_applications','donation_campaigns',
    'donations','consent_records','data_requests','audit_log'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = current_setting(''app.tenant_id'')::uuid)', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Annual rollover: final-year students become alumni.
-- Admin-triggered with a dry-run preview, never automatic.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION rollover_batch(p_tenant uuid, p_batch int, p_dry_run boolean DEFAULT true)
RETURNS TABLE (member_id uuid, full_name text, roll_number text) AS $$
BEGIN
  IF p_dry_run THEN
    RETURN QUERY
      SELECT m.id, m.full_name, m.roll_number FROM members m
      WHERE m.tenant_id = p_tenant AND m.batch_year = p_batch
        AND m.status = 'active_student';
  ELSE
    RETURN QUERY
      UPDATE members m SET status = 'active_alumni', updated_at = now()
      WHERE m.tenant_id = p_tenant AND m.batch_year = p_batch
        AND m.status = 'active_student'
      RETURNING m.id, m.full_name, m.roll_number;
  END IF;
END $$ LANGUAGE plpgsql;

-- ------------------------------------------------------------
-- Tenant branding. Seeds only — ramps are derived at resolve time
-- so the algorithm can improve without a data migration.
-- ------------------------------------------------------------

CREATE TABLE tenant_branding (
  tenant_id      uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  portal_name    text NOT NULL,
  tagline        text,
  primary_hex    char(7) NOT NULL,
  accent_hex     char(7),
  surface_hex    char(7) NOT NULL DEFAULT '#ffffff',
  surface_dark_hex char(7) NOT NULL DEFAULT '#0f1115',
  logo_primary   text,
  logo_inverse   text,
  logo_mark      text,
  crest          text,
  og_image       text,
  hero_image     text,
  font_display   text NOT NULL DEFAULT 'Fraunces',
  font_body      text NOT NULL DEFAULT 'Inter',
  radius         text NOT NULL DEFAULT 'subtle',
  support_email  citext,
  published      boolean NOT NULL DEFAULT false,
  updated_by     uuid REFERENCES members(id),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CHECK (radius IN ('none','subtle','rounded'))
);

ALTER TABLE tenant_branding ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON tenant_branding
  USING (tenant_id = current_setting('app.tenant_id')::uuid);
