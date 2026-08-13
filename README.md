# Moderador ITAMMUN

Prototipo funcional para preparar y conducir debates de ITAMMUN. El catálogo de comités, países, banderas y tópicos se toma de datos de prueba; el tópico, asistencia, oradores, tiempos, apelaciones y votos se guardan únicamente en el navegador.

## Funcionalidad

- Inicio sin cuentas con diez comités y lienzo en blanco.
- Setup obligatorio: tópico y participantes antes de iniciar el debate.
- Lista de oradores libre, pase de lista con estados por texto y color y tiempos por teclado.
- Caucus moderado con tiempo total, tiempo por orador y extensión de un segundo menos.
- Apelaciones procesales con votación inmediata.
- Votación nominal y pantalla de proyector con el país/persona que emite su voto.
- Sincronización entre pestañas del mismo navegador mediante `BroadcastChannel`.
- Acceso público por defecto y contraseña HTTP opcional al publicar.
- Manifiesto PWA: la web puede instalarse desde un navegador compatible.

## Desarrollo local

Requiere Node.js 22.13 o posterior.

```bash
npm install
npm run dev -- --port 4317
```

Se usa `4317` en la documentación para no interferir con procesos que ocupen `3000` o `4000`.

Verificación completa:

```bash
npm run lint
npm test
```

## Catálogo PostgreSQL de prueba

El archivo [`sql/001_catalog_test.sql`](sql/001_catalog_test.sql) crea el esquema `moderator_test` con comités, colores, tópicos, países, banderas y observadores.

```bash
psql "postgresql://usuario:password@localhost:5432/base" \
  -f sql/001_catalog_test.sql
```

La aplicación todavía usa el adaptador local de [`app/lib/test-catalog.ts`](app/lib/test-catalog.ts). El SQL prepara el contrato de la futura conexión de solo lectura; **no contiene estado del debate**.

## Estado local y privacidad

- Setup: `localStorage[itammun:setup:<slug>]`.
- Debate: `localStorage[itammun:session:<slug>]`.
- Reiniciar el setup del mismo comité reemplaza el debate local anterior.
- Abrir la misma URL en otro dispositivo no comparte votos, asistencia ni oradores.
- `Compartir` copia el enlace de setup del comité para que otra persona cree su propia sesión local.

## Contraseña de publicación

Si `MODERATOR_PASSWORD` no existe, el sitio es público. Si se define, el Worker exige autenticación HTTP Basic para todo el subdominio. En producción debe configurarse como secreto del proveedor, nunca en el repositorio.

```bash
npx wrangler secret put MODERATOR_PASSWORD
```

No se implementaron usuarios, roles ni recuperación de contraseña.

## Documentación

- [Plan, flujos y borradores de ventanas](docs/plan-implementacion.md)
- [Reglas de votación y puntos configurables](docs/votacion-y-protocolo.md)
- [Contrato del catálogo de prueba](docs/catalogo-postgresql.md)
