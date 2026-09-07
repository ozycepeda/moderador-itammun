# Moderador ITAMMUN

Aplicación para preparar y conducir debates de ITAMMUN. El catálogo de comités, países, jueces, banderas, tópicos y cupos ocupados se consulta desde la API pública de `itammun.itam.mx`. El debate activo permanece en el navegador y, al finalizar una sesión, la asistencia se guarda como un cierre inmutable en Cloudflare D1 además de descargarse como CSV.

## Funcionalidad

- Acceso general protegido por una contraseña compartida, sin cuentas individuales.
- Inicio con diez comités y lienzo en blanco.
- Interfaz completa en español e inglés con preferencia persistente entre páginas y pestañas.
- Setup obligatorio con título de sesión; sólo los cupos `occupied` llegan preseleccionados y el catálogo completo permanece disponible durante la preparación. Únicamente las representaciones marcadas pasan al debate, pase de lista y CSV.
- Pase de lista siempre editable con botones de estado; después se elige o crea el tópico.
- Lista de oradores limitada a participantes en sala y reordenable. El orador puede ceder a preguntas y respuestas, a la Mesa o al siguiente turno.
- Preguntas y respuestas ordinarias usan el remanente del orador; la sesión extraordinaria mantiene una cola independiente sin cronómetro.
- Caucus moderado y caucus simple con cronómetros independientes y extensión de un segundo menos.
- Cada cuatro llamadas de atención generan una falta; ambas cifras aparecen en la consola y en votaciones.
- Exportación CSV de asistencia por sesión con todos los países, estado, warnings y faltas.
- Cierre seguro e idempotente: D1 confirma un recibo antes de borrar el debate local; ante un error se conserva la sesión y se genera el CSV de respaldo.
- Panel administrativo bilingüe y de sólo lectura en `/admin/asistencia`, con filtros, detalle por sesión y exportación consolidada.
- Mociones y apelaciones se conservan en el código detrás de una bandera desactivada y no son accesibles en esta edición.
- Votación final nominal en tres rondas, exclusiva para países `presente y votando`, con explicaciones entre la segunda y tercera ronda.
- Sincronización entre pestañas del mismo navegador mediante `BroadcastChannel`.
- Manifiesto PWA: la web puede instalarse desde un navegador compatible.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
npm install
cp .dev.vars.example .dev.vars
npm run dev -- --port 4317
```

Edita `.dev.vars` con una contraseña compartida y un secreto aleatorio de al menos 32 caracteres. Este archivo no se versiona. Para dejar la aplicación pública después del evento, cambia `ACCESS_MODE=public`; en producción estos valores se administran como variables del hosting.

Se usa `4317` en la documentación para no interferir con procesos que ocupen `3000` o `4000`.

El entorno local crea una D1 aislada dentro de `.wrangler/`; no contiene ni modifica la base del sitio institucional. Las computadoras sólo compartirán una bitácora cuando apunten al mismo despliegue remoto de Moderador.

Verificación completa:

```bash
npm run lint
npm test
```

## Catálogo de ITAMMUN

La aplicación obtiene el catálogo exclusivamente a través de HTTPS:

```text
https://itammun.itam.mx/api/public/debates/<uuid-del-comité>
```

`ITAMMUN_API_BASE_URL` permite cambiar la URL en el futuro. No coloques credenciales de phpMyAdmin, MySQL o PostgreSQL en este repositorio: el navegador y la aplicación sólo necesitan el API público de lectura. Si el API no responde, el setup muestra un error y no sustituye silenciosamente países reales por datos de prueba.

### PostgreSQL de prueba heredado

El archivo [`sql/001_catalog_test.sql`](sql/001_catalog_test.sql) crea el esquema `moderator_test` con comités, colores, tópicos, países, banderas y observadores.

```bash
psql "postgresql://usuario:password@localhost:5432/base" \
  -f sql/001_catalog_test.sql
```

El SQL y [`app/lib/test-catalog.ts`](app/lib/test-catalog.ts) se conservan como fixture heredado para desarrollo aislado; la ruta normal ya no los usa. **No contienen estado del debate**.

## Estado local, D1 y privacidad

- Setup: `localStorage[itammun:setup:<slug>]`.
- Debate: `localStorage[itammun:session:<slug>]`.
- Idioma: `localStorage[itammun:language]` (`es` o `en`).
- Finalizar la sesión pide confirmación, envía a D1 un snapshot de todos los participantes y estados, recibe un comprobante, descarga el mismo CSV del pase de lista, elimina el debate local y regresa al selector.
- Si el guardado central falla, la sesión no se elimina y puede reintentarse. El CSV de emergencia se descarga de todos modos.
- Reiniciar el setup del mismo comité reemplaza el debate local anterior.
- Abrir la misma URL en otro dispositivo no comparte votos, asistencia ni oradores.
- `Compartir` copia el enlace de setup del comité para que otra persona cree su propia sesión local.
- Cada sesión recibe un UUID, título obligatorio y fechas de inicio/cierre. D1 conserva el cierre durante seis meses; la depuración ocurre al guardar o consultar la bitácora.
- D1 usa tablas operativas separadas del catálogo PostgreSQL/MySQL institucional. El navegador nunca recibe credenciales de base de datos.

## Migraciones de asistencia

El contrato Drizzle está en [`db/schema.ts`](db/schema.ts) y la migración SQL generada vive en [`drizzle/0000_empty_daimon_hellstrom.sql`](drizzle/0000_empty_daimon_hellstrom.sql). El Worker también crea las tablas de forma idempotente al primer acceso, necesario para el flujo local de Sites.

```bash
npm run db:generate
```

No edites una migración ya desplegada; agrega una nueva migración cuando cambie el esquema. La API de escritura y `/admin/asistencia` siempre exigen la contraseña general, incluso con `ACCESS_MODE=public`.

## Documentación

- [Plan, flujos y borradores de ventanas](docs/plan-implementacion.md)
- [Reglas de votación y puntos configurables](docs/votacion-y-protocolo.md)
- [Integración del catálogo de ITAMMUN](docs/catalogo-postgresql.md)
- [Asistencia CSV y evaluación de persistencia](docs/asistencia-y-persistencia.md)
