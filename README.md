# Moderador ITAMMUN

Primera consola funcional para conducir los comités de ITAMMUN.

## Incluido

- Inicio abierto con los diez comités de ITAMMUN 2026 y lienzo en blanco.
- Consola por URL compartible.
- Datos de tópicos y representaciones desde la API pública de ITAMMUN.
- Selector obligatorio de tópico antes del pase de lista.
- Lista de oradores libre.
- Pase de lista con estados desplegables por color.
- Entrada de tiempos por teclado.
- Extensión de caucus con la regla de un segundo menos.
- API y migración PostgreSQL para estado multiusuario.

La especificación actual se encuentra en [docs/plan-implementacion.md](docs/plan-implementacion.md).

## Desarrollo

```bash
npm install
npm run dev
```

La interfaz puede usarse en modo borrador local. Para colaboración entre dispositivos:

1. Ejecutar `sql/001_moderator.sql` en PostgreSQL.
2. Copiar `.env.example` a `.env` y ajustar `DATABASE_URL`.
3. Iniciar `npm run dev:api` además de `npm run dev`.

En producción, el proxy del subdominio debe servir la interfaz y enrutar `/api/moderator` hacia la API.
