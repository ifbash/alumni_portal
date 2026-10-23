-- ============================================================
-- Alumni Portal — community modules
--
-- Groups and chapters, the community feed, the business directory, the
-- showcase, invitations, the help desk, the college's own pages, and the
-- columns events need for webinars, reunions and member proposals.
--
-- Everything here follows the rules of 0001: every tenant table carries
-- tenant_id, has row-level security ENABLED and FORCED with the same
-- fail-closed policy, and is granted to alumni_app with only the privileges
-- the application needs.
--
-- One improvement on 0001, applied to the new tables only: foreign keys to
-- members and groups are COMPOSITE, (id, tenant_id). A plain FK checks that
-- the parent exists, not that it belongs to the same college, and FK checks
-- do not go through row-level security. With a composite key a row in
-- college A cannot point at a member of college B whatever the application
-- does. (See docs/SECURITY.md, "Cross-tenant foreign keys are not
-- composite".) Retrofitting the same onto the 0001 tables is a separate,
-- larger change.
-- ============================================================

-- ------------------------------------------------------------
-- Enums
-- ------------------------------------------------------------

CREATE TYPE group_kind          AS ENUM ('chapter', 'interest');
CREATE TYPE group_join_policy   AS ENUM ('open', 'approval');
CREATE TYPE group_member_role   AS ENUM ('member', 'lead');
CREATE TYPE group_member_state  AS ENUM ('active', 'requested');

CREATE TYPE post_kind  AS ENUM ('update', 'achievement', 'question', 'opportunity');
CREATE TYPE post_state AS ENUM ('published', 'hidden');

CREATE TYPE business_state AS ENUM ('pending_moderation', 'live', 'rejected', 'closed');

CREATE TYPE showcase_kind AS ENUM ('prominent', 'achievement', 'story');
CREATE TYPE showcase_category AS ENUM (
  'leadership', 'entrepreneur', 'civil_services', 'academia', 'public_sector',
  'defence_space', 'research', 'arts_sports', 'social_impact'
);
CREATE TYPE showcase_state AS ENUM ('pending_moderation', 'published', 'rejected');

CREATE TYPE invitation_state AS ENUM ('sent', 'joined', 'expired');

CREATE TYPE ticket_kind     AS ENUM ('help', 'feedback', 'bug');
CREATE TYPE ticket_category AS ENUM ('account', 'verification', 'profile', 'privacy', 'events', 'jobs', 'other');
CREATE TYPE ticket_state    AS ENUM ('open', 'answered', 'closed');

CREATE TYPE page_audience AS ENUM ('public', 'members');

CREATE TYPE event_kind AS ENUM ('reunion', 'meetup', 'webinar', 'workshop', 'hackathon', 'campus', 'other');
CREATE TYPE event_mode AS ENUM ('in_person', 'online', 'hybrid');
CREATE TYPE event_review_state AS ENUM ('approved', 'pending', 'rejected');

-- ------------------------------------------------------------
-- Composite-key targets. A composite FK needs a unique constraint on the
-- exact column pair it references.
-- ------------------------------------------------------------

ALTER TABLE members ADD CONSTRAINT members_id_tenant_uniq UNIQUE (id, tenant_id);

-- ------------------------------------------------------------
-- Groups and chapters
-- ------------------------------------------------------------

CREATE TABLE groups (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug         text NOT NULL,
  name         text NOT NULL,
  kind         group_kind NOT NULL,
  description  text NOT NULL,
  -- A chapter is for a place. An interest group is not.
  city         text,
  country      char(2),
  join_policy  group_join_policy NOT NULL DEFAULT 'open',
  -- Groups are archived, never deleted: their history stays, and the
  -- application role is not granted DELETE.
  archived     boolean NOT NULL DEFAULT false,
  created_by   uuid,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (created_by, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_group_place_is_chapter_only CHECK (kind = 'chapter' OR (city IS NULL AND country IS NULL)),
  CONSTRAINT chk_group_chapter_has_place     CHECK (kind <> 'chapter' OR city IS NOT NULL OR country IS NOT NULL),
  CONSTRAINT chk_group_country_code          CHECK (country IS NULL OR country ~ '^[A-Z]{2}$')
);

CREATE TABLE group_members (
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  group_id   uuid NOT NULL,
  member_id  uuid NOT NULL,
  role       group_member_role NOT NULL DEFAULT 'member',
  state      group_member_state NOT NULL DEFAULT 'active',
  joined_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, member_id),
  FOREIGN KEY (group_id, tenant_id)  REFERENCES groups  (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  -- A request is not a leader. Leads are active members.
  CONSTRAINT chk_group_lead_is_active CHECK (role = 'member' OR state = 'active')
);

CREATE INDEX idx_group_members_member ON group_members (member_id, state);

-- ------------------------------------------------------------
-- The community feed
-- ------------------------------------------------------------

CREATE TABLE posts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_id     uuid NOT NULL,
  -- Null is the open feed; a group's id is its noticeboard.
  group_id      uuid,
  kind          post_kind NOT NULL,
  body          text NOT NULL,
  tags          text[] NOT NULL DEFAULT '{}',
  state         post_state NOT NULL DEFAULT 'published',
  hidden_reason text,
  hidden_by     uuid,
  hidden_at     timestamptz,
  -- The author taking their own post down. A flag, not a DELETE: a post that
  -- was reported and then removed is still something a moderator may need.
  removed_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (author_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (group_id, tenant_id)  REFERENCES groups  (id, tenant_id),
  FOREIGN KEY (hidden_by, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_post_body_length CHECK (char_length(body) BETWEEN 10 AND 1200),
  CONSTRAINT chk_post_tag_count   CHECK (cardinality(tags) <= 5),
  -- A hidden post says why. A moderator cannot hide with no reason.
  CONSTRAINT chk_post_hidden_has_reason CHECK (state = 'published' OR (hidden_reason IS NOT NULL AND char_length(hidden_reason) >= 12))
);

CREATE INDEX idx_posts_feed  ON posts (tenant_id, created_at DESC) WHERE state = 'published' AND removed_at IS NULL;
CREATE INDEX idx_posts_group ON posts (group_id, created_at DESC) WHERE group_id IS NOT NULL;
CREATE INDEX idx_posts_tags  ON posts USING gin (tags);

CREATE TABLE post_likes (
  tenant_id  uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id    uuid NOT NULL,
  member_id  uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id),
  FOREIGN KEY (post_id, tenant_id)   REFERENCES posts   (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (member_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE CASCADE
);

CREATE TABLE post_reports (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  post_id     uuid NOT NULL,
  reporter_id uuid NOT NULL,
  reason      text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  -- One report per person per post: a count of two means two people.
  UNIQUE (post_id, reporter_id),
  FOREIGN KEY (post_id, tenant_id)     REFERENCES posts   (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_report_reason_length CHECK (char_length(reason) BETWEEN 8 AND 300)
);

-- ------------------------------------------------------------
-- Events: webinars, reunions, chapter meetups, member proposals
-- ------------------------------------------------------------

ALTER TABLE events
  ADD COLUMN kind            event_kind NOT NULL DEFAULT 'other',
  ADD COLUMN mode            event_mode NOT NULL DEFAULT 'in_person',
  -- Shown only to people who are registered. Never in a list.
  ADD COLUMN meeting_url     text,
  ADD COLUMN batch_year      int,
  ADD COLUMN group_id        uuid,
  ADD COLUMN review_state    event_review_state NOT NULL DEFAULT 'approved',
  ADD COLUMN proposed_by     uuid,
  ADD COLUMN moderation_note text;

ALTER TABLE events
  ADD CONSTRAINT events_group_fk    FOREIGN KEY (group_id, tenant_id)    REFERENCES groups  (id, tenant_id),
  ADD CONSTRAINT events_proposer_fk FOREIGN KEY (proposed_by, tenant_id) REFERENCES members (id, tenant_id),
  -- A join link is an https address, and only an event held online has one.
  ADD CONSTRAINT events_meeting_url_https CHECK (meeting_url IS NULL OR meeting_url ~ '^https://[^[:space:]]+$'),
  ADD CONSTRAINT events_online_needs_link CHECK (mode = 'in_person' OR meeting_url IS NOT NULL),
  ADD CONSTRAINT events_in_person_no_link CHECK (mode <> 'in_person' OR meeting_url IS NULL),
  -- Only a reunion is for a batch.
  ADD CONSTRAINT events_batch_is_reunion  CHECK (batch_year IS NULL OR kind = 'reunion'),
  -- A proposal is never published. Approving flips both together.
  ADD CONSTRAINT events_unreviewed_unpublished CHECK (review_state = 'approved' OR published = false),
  ADD CONSTRAINT events_decline_has_reason CHECK (review_state <> 'rejected' OR moderation_note IS NOT NULL);

CREATE INDEX idx_events_group    ON events (group_id) WHERE group_id IS NOT NULL;
CREATE INDEX idx_events_review   ON events (tenant_id, review_state) WHERE review_state = 'pending';

-- ------------------------------------------------------------
-- The business directory
-- ------------------------------------------------------------

CREATE TABLE businesses (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  owner_id       uuid NOT NULL,
  slug           text NOT NULL,
  name           text NOT NULL,
  industry       text NOT NULL,
  description    text NOT NULL,
  city           text,
  region         text,
  country        char(2),
  website        text,
  products       text[] NOT NULL DEFAULT '{}',
  services       text[] NOT NULL DEFAULT '{}',
  status         business_state NOT NULL DEFAULT 'pending_moderation',
  moderation_note text,
  moderated_by   uuid,
  moderated_at   timestamptz,
  -- Contact details exist only when the owner chose to share them. The
  -- second gate (the viewer is not a student) is applied by the read layer;
  -- this constraint makes the first gate structural.
  show_contact   boolean NOT NULL DEFAULT false,
  contact_email  citext,
  contact_phone  text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (owner_id, tenant_id)     REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (moderated_by, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_business_contact_only_if_shared CHECK (show_contact OR (contact_email IS NULL AND contact_phone IS NULL)),
  CONSTRAINT chk_business_website_https          CHECK (website IS NULL OR website ~ '^https://[^[:space:]]+$'),
  CONSTRAINT chk_business_country_code           CHECK (country IS NULL OR country ~ '^[A-Z]{2}$'),
  CONSTRAINT chk_business_list_sizes             CHECK (cardinality(products) <= 8 AND cardinality(services) <= 8),
  -- A refusal says why, so a resubmission can succeed.
  CONSTRAINT chk_business_rejected_has_reason    CHECK (status <> 'rejected' OR (moderation_note IS NOT NULL AND char_length(moderation_note) >= 12))
);

CREATE INDEX idx_businesses_live ON businesses (tenant_id, industry, city) WHERE status = 'live';
CREATE INDEX idx_businesses_owner ON businesses (owner_id);
CREATE INDEX idx_businesses_name_trgm ON businesses USING gin (name gin_trgm_ops);

-- ------------------------------------------------------------
-- The showcase
--
-- An entry is about a named person. The constraint on `published` below is
-- the DPDP rule made structural: nothing about a member is published
-- without their agreement on record, and nothing about somebody who is not
-- a member is published without a public source.
-- ------------------------------------------------------------

CREATE TABLE showcase_entries (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug                text NOT NULL,
  kind                showcase_kind NOT NULL,
  category            showcase_category NOT NULL,
  headline            text NOT NULL,
  summary             text NOT NULL,
  story               text,
  display_name        text NOT NULL,
  member_id           uuid,
  batch_year          int,
  department_id       uuid REFERENCES departments(id),
  achieved_on         date,
  source_url          text,
  featured            boolean NOT NULL DEFAULT false,
  source              text NOT NULL DEFAULT 'curated' CHECK (source IN ('curated', 'submitted')),
  submitted_by        uuid,
  state               showcase_state NOT NULL DEFAULT 'pending_moderation',
  moderation_note     text,
  -- Their agreement to be featured, and who confirmed it (themselves, by
  -- submitting; or a curator, attesting on their behalf).
  consent_recorded_at timestamptz,
  consent_confirmed_by uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (member_id, tenant_id)            REFERENCES members (id, tenant_id) ON DELETE SET NULL (member_id),
  FOREIGN KEY (submitted_by, tenant_id)         REFERENCES members (id, tenant_id) ON DELETE SET NULL (submitted_by),
  FOREIGN KEY (consent_confirmed_by, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_showcase_source_https CHECK (source_url IS NULL OR source_url ~ '^https://[^[:space:]]+$'),
  CONSTRAINT chk_showcase_published_needs_consent_or_source CHECK (
    state <> 'published'
    OR (member_id IS NOT NULL AND consent_recorded_at IS NOT NULL)
    OR (member_id IS NULL AND source_url IS NOT NULL)
  ),
  CONSTRAINT chk_showcase_rejected_has_reason CHECK (state <> 'rejected' OR (moderation_note IS NOT NULL AND char_length(moderation_note) >= 12))
);

CREATE INDEX idx_showcase_published ON showcase_entries (tenant_id, kind, category, created_at DESC) WHERE state = 'published';

-- ------------------------------------------------------------
-- Invitations
--
-- A name and an address, supplied by a third party, for somebody who has
-- agreed to nothing. Readable only by the inviter (the policy below is
-- tenant isolation; the application adds the inviter filter and the college
-- never queries this table). Expired rows are deleted by a job.
-- ------------------------------------------------------------

CREATE TABLE invitations (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  inviter_id        uuid NOT NULL,
  email             citext NOT NULL,
  name              text,
  batch_year        int,
  message           text,
  state             invitation_state NOT NULL DEFAULT 'sent',
  claimed_member_id uuid,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  UNIQUE (inviter_id, email),
  FOREIGN KEY (inviter_id, tenant_id)        REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (claimed_member_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE SET NULL (claimed_member_id),
  CONSTRAINT chk_invitation_message_length CHECK (message IS NULL OR char_length(message) <= 300)
);

CREATE INDEX idx_invitations_week ON invitations (inviter_id, created_at DESC);

-- ------------------------------------------------------------
-- The help desk
-- ------------------------------------------------------------

CREATE TABLE support_tickets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  -- What the member quotes: HD-1042. Numbered by the application, per college.
  reference   text NOT NULL,
  member_id   uuid NOT NULL,
  kind        ticket_kind NOT NULL DEFAULT 'help',
  category    ticket_category NOT NULL DEFAULT 'other',
  subject     text NOT NULL,
  -- The page the feedback button was pressed on. A path, never a query string.
  page_path   text,
  state       ticket_state NOT NULL DEFAULT 'open',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, reference),
  UNIQUE (id, tenant_id),
  FOREIGN KEY (member_id, tenant_id) REFERENCES members (id, tenant_id) ON DELETE CASCADE,
  CONSTRAINT chk_ticket_page_path_is_a_path CHECK (page_path IS NULL OR page_path ~ '^/[^?#[:space:]]{0,198}$')
);

CREATE INDEX idx_tickets_queue  ON support_tickets (tenant_id, state, created_at);
CREATE INDEX idx_tickets_member ON support_tickets (member_id, updated_at DESC);

-- Append-only, like the audit log: what a member and the college said to
-- each other is a record, and the application role cannot edit or delete it.
CREATE TABLE ticket_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  ticket_id   uuid NOT NULL,
  author_id   uuid NOT NULL,
  from_staff  boolean NOT NULL DEFAULT false,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (ticket_id, tenant_id) REFERENCES support_tickets (id, tenant_id) ON DELETE CASCADE,
  FOREIGN KEY (author_id, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_ticket_message_length CHECK (char_length(body) BETWEEN 2 AND 2000)
);

CREATE INDEX idx_ticket_messages ON ticket_messages (ticket_id, created_at);

-- ------------------------------------------------------------
-- Pages the college edits itself
-- ------------------------------------------------------------

CREATE TABLE cms_pages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug           text NOT NULL,
  title          text NOT NULL,
  -- A small, safe Markdown subset (src/lib/content/markdown.ts), stored as
  -- written and drawn through a renderer that never produces markup from it.
  body           text NOT NULL,
  audience       page_audience NOT NULL DEFAULT 'public',
  published      boolean NOT NULL DEFAULT false,
  show_in_footer boolean NOT NULL DEFAULT false,
  sort_order     int NOT NULL DEFAULT 100,
  updated_by     uuid,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  FOREIGN KEY (updated_by, tenant_id) REFERENCES members (id, tenant_id),
  CONSTRAINT chk_cms_slug_shape   CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT chk_cms_body_length  CHECK (char_length(body) <= 20000),
  -- The public footer is read by people who are not signed in.
  CONSTRAINT chk_cms_footer_is_public CHECK (NOT show_in_footer OR audience = 'public')
);

-- ------------------------------------------------------------
-- Row-level security on every new tenant table. Same policy, same
-- fail-closed behaviour as 0001 (app_tenant_id() is NULL without a tenant
-- context, so a query with none returns nothing).
-- ------------------------------------------------------------

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'groups','group_members','posts','post_likes','post_reports',
    'businesses','showcase_entries','invitations',
    'support_tickets','ticket_messages','cms_pages'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I USING (tenant_id = app_tenant_id()) WITH CHECK (tenant_id = app_tenant_id())', t);
  END LOOP;
END $$;

-- ------------------------------------------------------------
-- Grants. Only what the application needs:
--
--   * groups, businesses, showcase_entries, support_tickets: no DELETE.
--     They are archived, closed or declined, never erased by the app.
--   * ticket_messages: SELECT and INSERT only, like audit_log.
--   * post_reports: no DELETE; resolving a report sets resolved_at.
-- ------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE         ON groups, businesses, showcase_entries, support_tickets, post_reports, posts TO alumni_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON group_members, invitations, cms_pages TO alumni_app;
GRANT SELECT, INSERT, DELETE         ON post_likes TO alumni_app;
GRANT SELECT, INSERT                 ON ticket_messages TO alumni_app;
