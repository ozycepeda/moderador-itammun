CREATE SCHEMA IF NOT EXISTS moderator;

CREATE TABLE IF NOT EXISTS moderator.committee_theme (
  committee_slug text PRIMARY KEY,
  external_committee_id uuid UNIQUE,
  accent_color varchar(7) NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  dark_color varchar(7) NOT NULL CHECK (dark_color ~ '^#[0-9A-Fa-f]{6}$'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO moderator.committee_theme
  (committee_slug, external_committee_id, accent_color, dark_color)
VALUES
  ('onu-mujeres', '27c2f7cf-0188-4733-b8f1-2406c4313e52', '#3C98A5', '#1A3A3E'),
  ('acnur', 'eb2c6702-122d-4e3f-bae5-185731081340', '#82BAB7', '#1C3635'),
  ('unicef', '4194a8ae-e21d-4fdc-a3b1-db441b7ac397', '#72B7BE', '#1C3537'),
  ('cij', '8c77c124-bf8e-4079-b983-ce3a28b147fc', '#2D748E', '#142D36'),
  ('onudi', '2a18eb34-8372-40d5-9ce8-b8aa4134a845', '#7A966D', '#1E2E1A'),
  ('cepa', '116a16b6-36c0-4c0f-92ac-ec8c2a352cc6', '#83A33E', '#242E14'),
  ('banco-mundial', '019f9157-f987-4368-965a-5635cffb642f', '#3D8D2A', '#162A12'),
  ('consejo-de-seguridad', '49d413fb-16af-46a9-be9b-bbc2cbef6c84', '#837417', '#2A2510'),
  ('interpol', 'e8161904-e0d5-4904-8c8f-0cfe1de22435', '#B79D3E', '#2E2812'),
  ('otan', 'd33f3125-44d8-4b8b-a417-b973fd017069', '#E8B117', '#332A0C')
ON CONFLICT (committee_slug) DO UPDATE SET
  external_committee_id = EXCLUDED.external_committee_id,
  accent_color = EXCLUDED.accent_color,
  dark_color = EXCLUDED.dark_color,
  updated_at = now();

CREATE TABLE IF NOT EXISTS moderator.committee_session (
  committee_key text PRIMARY KEY,
  external_committee_id uuid,
  state jsonb NOT NULL DEFAULT '{}'::jsonb,
  revision bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS moderator.committee_presence (
  committee_key text NOT NULL REFERENCES moderator.committee_session(committee_key) ON DELETE CASCADE,
  client_id uuid NOT NULL,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (committee_key, client_id)
);

CREATE INDEX IF NOT EXISTS committee_presence_last_seen_idx
  ON moderator.committee_presence (committee_key, last_seen_at DESC);

COMMENT ON TABLE moderator.committee_session IS
  'Estado compartido y sin autenticación de la consola de cada comité.';
