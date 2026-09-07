# Asistencia centralizada, CSV y D1

## Arquitectura implementada

El debate activo sigue siendo local a cada navegador. Cada computadora puede operar un comité sin mezclar su cola, cronómetros o votaciones con los demás. Al pulsar **Finalizar sesión**, el navegador construye un snapshot y lo envía al Worker; el Worker valida y guarda el cierre en Cloudflare D1.

```text
Navegador de comité
  └─ POST /api/attendance/sessions/<uuid>/close
       └─ Worker protegido por contraseña
            └─ D1: attendance_sessions + attendance_entries

Administración
  └─ /admin/asistencia
       ├─ lista y filtros
       ├─ detalle inmutable por sesión
       └─ exportación CSV consolidada
```

La D1 de `localhost` es una base de desarrollo aislada en `.wrangler/`. Cuando Moderador se publique, todas las computadoras que usen el mismo dominio y despliegue escribirán en la misma D1 central.

## Datos guardados

`attendance_sessions` conserva UUID, título, comité, tópico, inicio, cierre, recepción, expiración, número de participantes y checksum. `attendance_entries` guarda una fila por participante seleccionado en setup, aun cuando su estado sea `Sin registrar`, `Ausente` u `Observador`.

Cada fila incluye:

- nombre principal bilingüe;
- nombre secundario bilingüe —país representado en ICJ—;
- código de país, tipo de representación y estado de asistencia;
- condición de observador;
- llamadas acumuladas, warnings activos y faltas.

La regla disciplinaria implementada es:

```text
faltas = floor(llamadas acumuladas / 4)
warnings activos = llamadas acumuladas % 4
```

## Cierre confiable e inmutable

El UUID de sesión es la llave de idempotencia. Reenviar exactamente el mismo cierre devuelve el recibo existente; intentar reemplazar ese UUID con datos diferentes devuelve conflicto. No existen rutas de edición ni eliminación en el panel.

El navegador elimina `localStorage` sólo después de recibir un recibo válido. Si D1 o la red fallan:

1. la sesión continúa abierta;
2. se descarga automáticamente el CSV local de respaldo;
3. la Mesa puede reintentar **Finalizar sesión**.

Tras un cierre correcto también se descarga el CSV y se vuelve al selector de comités. Así se conserva el respaldo solicitado sin depender de que alguien lo mande a administración.

## Acceso y seguridad

La API de cierre, el panel `/admin/asistencia` y sus APIs administrativas siempre están protegidos por la contraseña general y cookie `HttpOnly`, `SameSite=Strict`. Esto sigue aplicando si después del evento se configura `ACCESS_MODE=public` para el resto de la aplicación.

```text
ACCESS_MODE=protected
ACCESS_PIN=<contraseña compartida>
ACCESS_SESSION_SECRET=<secreto aleatorio de al menos 32 caracteres>
```

El POST exige mismo origen, valida tipos, tamaños, estados, UUID de ruta, fechas, duplicados y el cálculo de faltas. Ninguna credencial D1 se entrega al cliente. D1 es una base operativa separada de la fuente institucional de catálogo.

## Retención

Cada cierre recibe `expires_at` seis meses después de ser aceptado. Los registros expirados se eliminan al guardar, listar, abrir detalle o exportar. Esto evita depender de un cron para la primera versión; si en el futuro se exige borrado exacto al minuto, deberá añadirse un trigger programado del Worker.

## API administrativa

```text
GET /api/admin/attendance?committee=<slug>&from=AAAA-MM-DD&to=AAAA-MM-DD
GET /api/admin/attendance/<uuid>
GET /api/admin/attendance/export.csv?lang=es|en&committee=<slug>&from=...&to=...
```

Todas son de sólo lectura. El CSV consolidado incluye comité, sesión, fechas, participante/juez, país representado, estado y disciplina.

## Evolución futura hacia Node/PostgreSQL

D1 reduce operación porque Moderador ya corre como Worker. Si ITAM decide centralizar en un servicio Node administrado, se puede conservar el contrato HTTP y migrar únicamente la capa de almacenamiento. Node/PostgreSQL daría mayor integración institucional, pero requiere operar TLS, disponibilidad, respaldos, pool de conexiones, actualizaciones y monitoreo. El navegador nunca debe conectarse directamente a PostgreSQL.
