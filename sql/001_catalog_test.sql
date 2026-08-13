CREATE SCHEMA IF NOT EXISTS moderator_test;

CREATE TABLE IF NOT EXISTS moderator_test.committees (
  id uuid PRIMARY KEY,
  slug text UNIQUE NOT NULL,
  abbreviation text NOT NULL,
  name text NOT NULL,
  language char(2) NOT NULL CHECK (language IN ('ES', 'EN')),
  level text NOT NULL CHECK (level IN ('Bajo', 'Intermedio', 'Alto')),
  secretariat text NOT NULL,
  accent_color varchar(7) NOT NULL CHECK (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  dark_color varchar(7) NOT NULL CHECK (dark_color ~ '^#[0-9A-Fa-f]{6}$')
);

CREATE TABLE IF NOT EXISTS moderator_test.countries (
  iso3 char(3) PRIMARY KEY,
  iso2 char(2) UNIQUE NOT NULL,
  name_es text NOT NULL,
  flag_url text NOT NULL,
  is_observer boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS moderator_test.committee_topics (
  committee_id uuid NOT NULL REFERENCES moderator_test.committees(id) ON DELETE CASCADE,
  position smallint NOT NULL,
  title text NOT NULL,
  PRIMARY KEY (committee_id, position)
);

CREATE TABLE IF NOT EXISTS moderator_test.committee_countries (
  committee_id uuid NOT NULL REFERENCES moderator_test.committees(id) ON DELETE CASCADE,
  country_iso3 char(3) NOT NULL REFERENCES moderator_test.countries(iso3),
  position smallint NOT NULL,
  PRIMARY KEY (committee_id, country_iso3),
  UNIQUE (committee_id, position)
);

INSERT INTO moderator_test.committees
  (id, slug, abbreviation, name, language, level, secretariat, accent_color, dark_color)
VALUES
  ('27c2f7cf-0188-4733-b8f1-2406c4313e52', 'onu-mujeres', 'ONU Mujeres', 'ONU Mujeres', 'ES', 'Bajo', 'Asuntos Humanitarios', '#3C98A5', '#1A3A3E'),
  ('eb2c6702-122d-4e3f-bae5-185731081340', 'acnur', 'ACNUR', 'ACNUR', 'ES', 'Intermedio', 'Asuntos Humanitarios', '#82BAB7', '#1C3635'),
  ('4194a8ae-e21d-4fdc-a3b1-db441b7ac397', 'unicef', 'UNICEF', 'UNICEF', 'ES', 'Bajo', 'Asuntos Humanitarios', '#72B7BE', '#1C3537'),
  ('8c77c124-bf8e-4079-b983-ce3a28b147fc', 'cij', 'ICJ', 'International Court of Justice', 'EN', 'Alto', 'Asuntos Humanitarios', '#2D748E', '#142D36'),
  ('2a18eb34-8372-40d5-9ce8-b8aa4134a845', 'onudi', 'UNIDO', 'United Nations Industrial Development Organization', 'EN', 'Bajo', 'Economía y Desarrollo', '#7A966D', '#1E2E1A'),
  ('116a16b6-36c0-4c0f-92ac-ec8c2a352cc6', 'cepa', 'CEPA', 'CEPA', 'ES', 'Alto', 'Economía y Desarrollo', '#83A33E', '#242E14'),
  ('019f9157-f987-4368-965a-5635cffb642f', 'banco-mundial', 'Banco Mundial', 'Banco Mundial', 'ES', 'Intermedio', 'Economía y Desarrollo', '#3D8D2A', '#162A12'),
  ('49d413fb-16af-46a9-be9b-bbc2cbef6c84', 'consejo-de-seguridad', 'Consejo de Seguridad', 'Consejo de Seguridad', 'ES', 'Alto', 'Asuntos de Seguridad', '#837417', '#2A2510'),
  ('e8161904-e0d5-4904-8c8f-0cfe1de22435', 'interpol', 'INTERPOL', 'INTERPOL', 'ES', 'Intermedio', 'Asuntos de Seguridad', '#B79D3E', '#2E2812'),
  ('d33f3125-44d8-4b8b-a417-b973fd017069', 'otan', 'NATO', 'North Atlantic Treaty Organization', 'EN', 'Alto', 'Asuntos de Seguridad', '#E8B117', '#332A0C')
ON CONFLICT (slug) DO UPDATE SET
  abbreviation = EXCLUDED.abbreviation, name = EXCLUDED.name, language = EXCLUDED.language,
  level = EXCLUDED.level, secretariat = EXCLUDED.secretariat,
  accent_color = EXCLUDED.accent_color, dark_color = EXCLUDED.dark_color;

INSERT INTO moderator_test.countries (iso3, iso2, name_es, flag_url, is_observer) VALUES
  ('AFG','af','Afganistán','https://flagcdn.com/w80/af.png',false),
  ('DEU','de','Alemania','https://flagcdn.com/w80/de.png',false),
  ('ARG','ar','Argentina','https://flagcdn.com/w80/ar.png',false),
  ('AUS','au','Australia','https://flagcdn.com/w80/au.png',false),
  ('BEL','be','Bélgica','https://flagcdn.com/w80/be.png',false),
  ('BRA','br','Brasil','https://flagcdn.com/w80/br.png',false),
  ('BFA','bf','Burkina Faso','https://flagcdn.com/w80/bf.png',false),
  ('CAN','ca','Canadá','https://flagcdn.com/w80/ca.png',false),
  ('CHL','cl','Chile','https://flagcdn.com/w80/cl.png',false),
  ('CHN','cn','China','https://flagcdn.com/w80/cn.png',false),
  ('COL','co','Colombia','https://flagcdn.com/w80/co.png',false),
  ('KOR','kr','Corea del Sur','https://flagcdn.com/w80/kr.png',false),
  ('CRI','cr','Costa Rica','https://flagcdn.com/w80/cr.png',false),
  ('EGY','eg','Egipto','https://flagcdn.com/w80/eg.png',false),
  ('ESP','es','España','https://flagcdn.com/w80/es.png',false),
  ('USA','us','Estados Unidos','https://flagcdn.com/w80/us.png',false),
  ('FIN','fi','Finlandia','https://flagcdn.com/w80/fi.png',false),
  ('FRA','fr','Francia','https://flagcdn.com/w80/fr.png',false),
  ('IND','in','India','https://flagcdn.com/w80/in.png',false),
  ('IDN','id','Indonesia','https://flagcdn.com/w80/id.png',false),
  ('JPN','jp','Japón','https://flagcdn.com/w80/jp.png',false),
  ('LUX','lu','Luxemburgo','https://flagcdn.com/w80/lu.png',false),
  ('MEX','mx','México','https://flagcdn.com/w80/mx.png',false),
  ('MOZ','mz','Mozambique','https://flagcdn.com/w80/mz.png',false),
  ('NOR','no','Noruega','https://flagcdn.com/w80/no.png',false),
  ('GBR','gb','Reino Unido','https://flagcdn.com/w80/gb.png',false),
  ('RWA','rw','Ruanda','https://flagcdn.com/w80/rw.png',false),
  ('SEN','sn','Senegal','https://flagcdn.com/w80/sn.png',false),
  ('ZAF','za','Sudáfrica','https://flagcdn.com/w80/za.png',false),
  ('SDN','sd','Sudán','https://flagcdn.com/w80/sd.png',false),
  ('UGA','ug','Uganda','https://flagcdn.com/w80/ug.png',false),
  ('VAT','va','Santa Sede (Observador)','https://flagcdn.com/w80/va.png',true),
  ('PSE','ps','Estado de Palestina (Observador)','https://flagcdn.com/w80/ps.png',true)
ON CONFLICT (iso3) DO UPDATE SET
  name_es = EXCLUDED.name_es, flag_url = EXCLUDED.flag_url, is_observer = EXCLUDED.is_observer;

INSERT INTO moderator_test.committee_countries (committee_id, country_iso3, position)
SELECT committee.id, country.iso3, row_number() OVER (PARTITION BY committee.id ORDER BY country.name_es)::smallint
FROM moderator_test.committees committee
CROSS JOIN moderator_test.countries country
ON CONFLICT (committee_id, country_iso3) DO NOTHING;

INSERT INTO moderator_test.committee_topics (committee_id, position, title)
SELECT id, 1, 'Tópico A de prueba' FROM moderator_test.committees
ON CONFLICT (committee_id, position) DO NOTHING;

INSERT INTO moderator_test.committee_topics (committee_id, position, title)
SELECT id, 2, 'Tópico B de prueba' FROM moderator_test.committees
ON CONFLICT (committee_id, position) DO NOTHING;

-- Consulta que usará el futuro adaptador de sólo lectura:
-- SELECT c.*, json_agg(json_build_object(
--   'id', p.iso3, 'name', p.name_es, 'flagUrl', p.flag_url,
--   'observer', p.is_observer
-- ) ORDER BY cp.position) AS representations
-- FROM moderator_test.committees c
-- JOIN moderator_test.committee_countries cp ON cp.committee_id = c.id
-- JOIN moderator_test.countries p ON p.iso3 = cp.country_iso3
-- WHERE c.slug = $1 GROUP BY c.id;
