# Catálogo PostgreSQL de prueba

## Alcance

`sql/001_catalog_test.sql` crea datos de prueba para validar la futura integración. PostgreSQL sólo será fuente del catálogo; no almacena el debate.

Esquema `moderator_test`:

| Tabla | Propósito |
|---|---|
| `committees` | comité, slug, idioma, nivel y colores |
| `countries` | ISO, nombre, URL de bandera y condición de observador |
| `committee_topics` | tópicos ordenados por comité |
| `committee_countries` | participantes disponibles por comité |

El script incluye diez comités, 33 países/observadores, banderas de FlagCDN y dos tópicos de prueba por comité. Se puede ejecutar varias veces; los inserts relevantes son idempotentes.

## Carga de prueba

```bash
createdb itammun_test
psql itammun_test -f sql/001_catalog_test.sql
```

Comprobaciones sugeridas:

```sql
SELECT count(*) FROM moderator_test.committees;
SELECT count(*) FROM moderator_test.countries;
SELECT slug, accent_color, dark_color FROM moderator_test.committees ORDER BY slug;
SELECT name_es, flag_url FROM moderator_test.countries ORDER BY name_es;
```

## Adaptador futuro

La interfaz consume `CommitteeDetail` desde `app/lib/itammun-api.ts`. En el siguiente sprint se reemplazará `getTestCommitteeDetail()` por una llamada servidor-servidor a un endpoint de sólo lectura.

Reglas de seguridad:

- nunca exponer `CATALOG_DATABASE_URL` al navegador;
- usar un usuario PostgreSQL con permiso `SELECT` únicamente sobre vistas autorizadas;
- validar el `slug` como parámetro, sin interpolarlo en SQL;
- no escribir asistencia, oradores, tiempos o votos en la base;
- cachear catálogo, pero tomar un snapshot local al crear el debate.

## Colores

Los campos `accent_color` y `dark_color` están presentes directamente en PostgreSQL. En el catálogo real deberán mapearse desde una tabla/vista existente o conservarse en una tabla de configuración de este proyecto.
