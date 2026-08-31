# Asistencia, CSV y persistencia futura

## Primera versión

Cada sesión tiene un UUID, un título definido por la administración y una fecha de inicio. El botón **Exportar asistencia CSV** aparece debajo del pase de lista y genera un archivo UTF-8 compatible con Excel.

El reporte incluye todos los países o representaciones, incluso los estados `Sin registrar` y `Ausente`, además de cupo inicial, observador, llamadas acumuladas, warnings activos y faltas.

Las llamadas se conservan como contador acumulado para no perder auditoría:

```text
faltas = floor(llamadas acumuladas / 3)
warnings activos = llamadas acumuladas % 3
```

El archivo se genera exclusivamente en el navegador. No se transmite a ITAMMUN, OpenAI ni Cloudflare.

## Acceso general

El Worker protege todas las rutas antes de renderizar la aplicación. `/acceso` valida la contraseña contra `ACCESS_PIN` y entrega una cookie `HttpOnly`, `SameSite=Strict`, con vigencia de 12 horas. La firma usa un secreto independiente en `ACCESS_SESSION_SECRET`.

Configuración:

```text
ACCESS_MODE=protected
ACCESS_PIN=<contraseña compartida>
ACCESS_SESSION_SECRET=<secreto aleatorio de al menos 32 caracteres>
```

Después del evento puede usarse `ACCESS_MODE=public` sin recompilar la aplicación. Los secretos nunca deben incluirse en Git ni en el JavaScript del navegador.

## Persistencia futura: D1 frente a Node/PostgreSQL

### D1

D1 es una base SQL serverless de Cloudflare con semántica SQLite. Se enlaza directamente al Worker, escala a cero y no requiere administrar un servidor. Para activarlo en Sites se cambia el binding lógico `d1` de `.openai/hosting.json`, se define el esquema en `db/schema.ts` y se generan migraciones con Drizzle.

Es la opción más sencilla para este proyecto porque la aplicación ya se ejecuta como Worker. La bitácora debe usar tablas separadas para sesiones, estado actual de asistencia y eventos inmutables.

### Node/PostgreSQL

Un servicio Node independiente ofrece mayor control, integración con el PostgreSQL institucional y herramientas de reporte conocidas. También obliga a operar proceso, TLS, actualizaciones, monitoreo, respaldos, pool de conexiones, disponibilidad y despliegues del API.

El navegador nunca debe conectarse directamente a PostgreSQL. El servicio Node debe exponer un API HTTPS y utilizar un esquema independiente del catálogo, por ejemplo `moderator_operations`.

### Recomendación

- D1 si Moderador continuará alojado en Sites y el objetivo es reducir operación.
- Node/PostgreSQL si ITAM ya ofrecerá infraestructura administrada, respaldos y soporte para ese servidor.
- En ambos casos conservar el CSV como respaldo y una cola local de eventos para operar durante fallas de internet.

Referencias vigentes al 31 de agosto de 2026:

- https://developers.cloudflare.com/d1/platform/pricing/
- https://developers.cloudflare.com/workers/platform/pricing/
- https://developers.cloudflare.com/d1/worker-api/d1-database/
- https://www.postgresql.org/docs/current/admin.html
