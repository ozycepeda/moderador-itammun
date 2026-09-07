# Integración del catálogo de ITAMMUN

## Fuente activa

Moderador no se conecta a phpMyAdmin ni directamente a una base de datos. El servidor de la aplicación consulta por HTTPS el endpoint público de lectura:

```text
GET https://itammun.itam.mx/api/public/debates/<uuid-del-comité>
```

Los UUID oficiales viven en `app/lib/committees.ts`. `app/lib/itammun-api.ts` valida y normaliza la respuesta. El setup utiliza `status=occupied` para marcar únicamente los cupos pagados; `available` permanece visible pero sin marcar. El estado del debate nunca se escribe en ese API.

Para cambiar el origen sin modificar código:

```text
ITAMMUN_API_BASE_URL=https://itammun.itam.mx/api/public
```

No se deben guardar credenciales de phpMyAdmin, MySQL o PostgreSQL en `.env`, `.dev.vars` ni Git para este flujo. Si en el futuro el API requiere autenticación, el secreto deberá residir sólo en el hosting y la llamada seguirá siendo servidor-servidor.

## Contrato normalizado

`CommitteeDetail` contiene tópicos, representaciones, identificadores ocupados y el estado de la fuente. Cada representación tiene un identificador estable, nombre bilingüe, bandera, tipo y estado de ocupación. Para ICJ, el mismo modelo representa un actor de tipo `judge` con dos etiquetas:

- principal: nombre del juez;
- secundaria: país representado, traducido por su código de bandera.

Los selectores de oradores y preguntas usan ambas etiquetas, por lo que ICJ puede buscarse por juez o país sin lógica especial en la consola. Si el API falla, el adaptador devuelve `source=unavailable`, lista vacía y una opción de reintento; nunca reemplaza datos reales por el fixture local.

## Fixture PostgreSQL heredado

`sql/001_catalog_test.sql` conserva datos de prueba para desarrollo aislado. PostgreSQL sólo modela el catálogo y no almacena el debate.

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

El fixture y `app/lib/test-catalog.ts` ya no forman parte de la ruta de producción. Se mantienen para pruebas manuales sin red y como referencia de una posible importación futura.

## Colores

El API público actual no entrega colores. `app/lib/committees.ts` conserva la paleta visual del moderador como configuración versionada. Si el API expone colores en el futuro, se podrán normalizar junto con el resto del catálogo sin cambiar los componentes.
