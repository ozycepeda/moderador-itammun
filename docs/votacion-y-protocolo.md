# Votación y decisiones de protocolo

## Votación final en tres rondas

La consola congela una sola fila al iniciar la votación. Entran exclusivamente los países o personas cuyo estado sea `presente y votando`, y todos participan en las tres rondas aunque su asistencia cambie después de comenzar.

1. Primera ronda: `A favor`, `En contra` o `Abstención`.
2. Segunda ronda: las tres opciones anteriores, además de `A favor con derecho a explicación` y `En contra con derecho a explicación`.
3. Explicaciones: antes de la tercera ronda se presentan, uno por uno y sin cronómetro, quienes solicitaron el derecho en la segunda ronda.
4. Tercera ronda: `A favor` o `En contra`.

Al cerrar cada etapa, la consola se detiene en una pantalla de transición. La Mesa debe confirmar manualmente el inicio de la segunda ronda, las explicaciones y la tercera ronda; la pantalla pública muestra la misma pausa y espera la indicación de la Mesa.

El resultado definitivo se calcula exclusivamente con la tercera ronda. El sistema conserva las tres papeletas nominales para auditoría local. Las amonestaciones aparecen junto al país durante la votación y en el resumen, pero no eliminan el derecho a votar ni cambian el resultado.

Esta es una decisión operativa de ITAMMUN para esta versión. Aunque algunas reglas de Modelo ONU limitan la abstención de quienes se declaran presentes y votando, la aplicación permite abstenerse en las rondas uno y dos por indicación expresa de las organizadoras.

## Elegibilidad y cambios de asistencia

- `presente y votando`: entra a todas las rondas y puede abstenerse en las rondas uno y dos;
- `presente`, `observador`, `ausente` o `sin registrar`: no entra a la votación final;
- las llamadas de atención son informativas y acumulables, sin máximo ni sanción automática;
- una votación ya iniciada mantiene su fila congelada;
- reiniciar la votación vuelve a tomar el estado de asistencia vigente.

## Lista de oradores, preguntas y cesiones

La sesión extraordinaria de preguntas vive dentro de Oradores. Sólo permite elegir países o personas del catálogo de la sesión y utiliza el mismo tiempo configurado para un orador. Su fila es independiente y reordenable.

Cuando un orador termina antes de tiempo puede ceder el remanente:

- a la Mesa, con lo que concluye su intervención; o
- al siguiente orador, que recibe su tiempo base más el remanente.

Para evitar una cadena indefinida de tiempo donado, quien ya recibió una donación no puede volver a ceder ese remanente al siguiente orador. La cesión a la Mesa sigue disponible.

## Caucus moderado y simple

La aplicación mantiene dos cronómetros independientes:

- el caucus moderado conserva la conducción de la Mesa y turnos reconocidos;
- el caucus simple permite negociación informal sin una lista central de oradores.

Ambos muestran el tópico, aceptan tiempo por teclado y ofrecen reiniciar, iniciar/pausar, aplicar la extensión de un segundo menos y finalizar. El caucus simple no duplica una lista de participantes ni una descripción, porque su diferencia operativa es la ausencia de turnos moderados.

Referencias generales de procedimiento:

- [ONU — Reglas de procedimiento para conferencias Modelo ONU](https://www.un.org/en/model-united-nations/rules-procedure)
- [ONU — Reglas de procedimiento de la Asamblea General](https://www.un.org/en/ga/about/ropga/ropga_plenary.shtml)

## Apelación a una decisión de la Mesa

Las apelaciones siguen separadas de la votación final. La consola registra quién apela y la decisión cuestionada, y abre inmediatamente una votación de `A favor` o `En contra` entre quienes estén `presente y votando` al iniciarla. Si hay más votos a favor, la decisión se revoca; en empate o mayoría en contra, se mantiene.

Referencia: [ONU — Anexo IV: votación inmediata y carácter no debatible](https://www.un.org/en/ga/about/ropga/ropga_anx4.shtml).

## Regla de un segundo menos

No resta tiempo a un reloj activo. Inicia una extensión cuya duración es un segundo menor que la duración original del caucus seleccionado.

Referencias:

- [Protocolo parlamentario alojado por la Cámara de Diputados, arts. 23–24](https://www5.diputados.gob.mx/index.php/esl/content/download/96091/481176/file/G20%20-%20Protocolo.pdf)
- [TECMUN 2025 — reglas de procedimiento](https://tec.mx/sites/default/files/repositorio/Campus/leon/munmx/documentos/2025/middle-school/1.pdf)

## Captura de tiempo

`TimeInput` acepta `MM:SS`, `HH:MM:SS` o segundos enteros; Enter confirma y normaliza. No se usan botones de incrementos predefinidos.
