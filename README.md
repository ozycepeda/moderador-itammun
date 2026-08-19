# Moderador ITAMMUN

Prototipo funcional para preparar y conducir debates de ITAMMUN. El catálogo de comités, países, banderas y tópicos se toma de datos de prueba; el tópico, asistencia, oradores, tiempos, apelaciones y votos se guardan únicamente en el navegador.

## Funcionalidad

- Inicio sin cuentas con diez comités y lienzo en blanco.
- Interfaz completa en español e inglés con preferencia persistente entre páginas y pestañas.
- Setup obligatorio para marcar los cupos ocupados; el catálogo completo permanece disponible.
- Pase de lista siempre editable con botones de estado; después se elige o crea el tópico.
- Lista de oradores reordenable, sesión extraordinaria de preguntas y cesión del tiempo restante a la Mesa o al siguiente orador.
- Caucus moderado y caucus simple con cronómetros independientes y extensión de un segundo menos.
- Llamadas de atención acumulables desde Pase de lista, sin sanciones automáticas.
- Apelaciones procesales con votación inmediata.
- Votación final nominal en tres rondas, exclusiva para países `presente y votando`, con explicaciones entre la segunda y tercera ronda.
- Sincronización entre pestañas del mismo navegador mediante `BroadcastChannel`.
- Acceso público, sin cuentas ni contraseña.
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
- Idioma: `localStorage[itammun:language]` (`es` o `en`).
- Reiniciar el setup del mismo comité reemplaza el debate local anterior.
- Abrir la misma URL en otro dispositivo no comparte votos, asistencia ni oradores.
- `Compartir` copia el enlace de setup del comité para que otra persona cree su propia sesión local.

## Documentación

- [Plan, flujos y borradores de ventanas](docs/plan-implementacion.md)
- [Reglas de votación y puntos configurables](docs/votacion-y-protocolo.md)
- [Contrato del catálogo de prueba](docs/catalogo-postgresql.md)
