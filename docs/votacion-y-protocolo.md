# Votación y decisiones de protocolo

## Configuración elegida

La primera versión usa votación **nominal**. Cada miembro elegible aparece por turno, la Mesa registra su voto y la pantalla pública muestra el país o persona actual.

La regla está representada directamente por el tipo `VoteChoice` y por el filtro de elegibilidad de la consola. La cola se congela al iniciar cada votación para que un cambio posterior de asistencia no altere una votación en curso.

Para cambiar a captura agregada en el futuro, se puede sustituir la interfaz de llamada individual por dos totales (`for`, `against`). Conviene conservar el modelo `ballots` para apelaciones o votaciones que necesiten trazabilidad nominal.

## Elegibilidad

- `presente y votando`: entra a la fila nominal y elige a favor o en contra;
- `presente`, `observador`, `ausente` o `sin registrar`: no entra a la fila.

No se ofrece abstención. Los observadores tampoco cuentan para quórum o mayorías.

## Apelación a una decisión de la Mesa

La recomendación se basa en las reglas de procedimiento de la Asamblea General de Naciones Unidas: una decisión de la presidencia sobre un punto de orden puede apelarse; la apelación se somete inmediatamente a votación y la decisión permanece salvo que una mayoría de miembros presentes y votando la revoque.

Implementación:

1. Se registra quién apela y qué decisión cuestiona.
2. Se abre inmediatamente la pregunta `¿Se revoca la decisión de la Mesa?`.
3. Se llama nominalmente a los miembros elegibles.
4. Cada país vota a favor o en contra; no hay abstenciones.
5. Si `a favor > en contra`, la decisión queda revocada; en cualquier otro caso se mantiene.

Referencias:

- [ONU — Reglas de procedimiento de la Asamblea General, punto de orden](https://www.un.org/en/ga/about/ropga/ropga_plenary.shtml)
- [ONU — Anexo IV: votación inmediata y carácter no debatible](https://www.un.org/en/ga/about/ropga/ropga_anx4.shtml)

Esta regla debe confirmarse contra el reglamento interno de ITAMMUN antes del evento.

## Regla de un segundo menos

No es un botón para restar tiempo al reloj activo. Se usa para proponer una extensión de caucus menor que la duración original.

Referencias:

- [Protocolo parlamentario alojado por la Cámara de Diputados, arts. 23–24](https://www5.diputados.gob.mx/index.php/esl/content/download/96091/481176/file/G20%20-%20Protocolo.pdf)
- [TECMUN 2025 — reglas de procedimiento](https://tec.mx/sites/default/files/repositorio/Campus/leon/munmx/documentos/2025/middle-school/1.pdf)

## Captura de tiempo

`TimeInput` acepta `MM:SS`, `HH:MM:SS` o segundos enteros; Enter confirma y normaliza. No se usan botones de incrementos predefinidos.
