# Módulos de la aplicación (versión 1.13)

`dist/app.js` es solo el punto de entrada: carga los módulos de esta carpeta en el orden de arranque original y llama a `buildScenario()` y al bucle de animación.

La versión 1.1 es una reestructuración pura de la 1.0 (antes llamada v16): cada línea viene del `app.js` original y ninguna cambia su comportamiento. Se comprobó así:
- Las 4 suites de pruebas pasan.
- 121 capturas de estado (unas 300.000 líneas) son idénticas a la 1.0: escena, posiciones, interfaz y lecturas.
- Las capturas en Chromium coinciden píxel a píxel.

## Mapa

| Módulo | Responsabilidad |
|---|---|
| `state.js` | Estado compartido `S`. Contiene solo lo que más de un módulo reasigna. Cada campo indica quién lo escribe. |
| `util.js` | `$`, `V`, `Q` y `tr` (texto ES/EN). |
| `scene.js` | Escena, cámara, renderer, controles de órbita, luces, mesa y rótulos del piso. |
| `bench.js` | Llave, cuerpo y display del multímetro, avisos del piso. |
| `probe-tools.js` | Construcción de las dos puntas. |
| `overlays.js` | Grupos de hitboxes y de anillos de pines. |
| `names.js` | Nombres de piezas y conectores. |
| `parts.js` | Constructores de MK3, EM y arneses. |
| `scenario.js` | Arma el banco de cada escenario (piezas, repuestos, uniones, fallas). |
| `spatial.js` | Posición y orientación en el mundo, búsquedas en el grafo de escena. |
| `connection.js` | Compatibilidad, alineación, conectar/desconectar, rosca. |
| `movement.js` | Mover y rotar la selección. |
| `colliders.js` | Volúmenes y consultas de colisión. **Se reconstruye en el paso 3.** |
| `cables.js` | Cable del arnés. **Se reconstruye en el paso 6.** |
| `probes.js` | Colocación, movimiento y cables de las puntas. Optimizado en la 1.13 (paso 2). **Los cables se rehacen en el paso 5.** |
| `bypass.js` | Conectores y cables del bypass. **Paso 7.** |
| `view.js` | Enfoque de la vista y resguardo de la cámara. **Paso 4.** |
| `meter.js` | Lecturas, display y panel del multímetro. |
| `input.js` | Ratón, rueda, doble clic y panel de orientación. |
| `ui.js` | Panel de selección, idioma, teclado y textos. |
| `screens.js` | Pantalla del MK3. |
| `hitboxes.js` | Visualización de hitboxes. |
| `guidance.js` | Anillos y etiquetas de pines de las lecciones. |
| `loop.js` | Bucle de animación y cambio de tamaño de ventana. |
| `learning-mount.js` | Monta la guía de lecciones (`../learning.js`). |
| `lessons-bridge.js` | `prepareLesson` y `lessonCheck`: lo que las lecciones leen del banco. |

Fuera de esta carpeta y sin cambios: `../electrical.js`, `../learning.js`, `../geometry.js`, `../collision.js`, `../drag-performance.js` y `../vendor/`.

## Reglas para modificar

1. **Un cambio, un módulo.** Si un arreglo obliga a tocar muchos módulos, primero hay que revisar el diseño.
2. **Estado compartido solo en `S`.** Una variable que otro módulo necesita reasignar va en `state.js`. Si solo se lee, se exporta desde su módulo.
3. **Los módulos de construcción no importan funciones de otros módulos.** Son `scene`, `bench`, `probe-tools` y `overlays`, y crean objetos y los añaden a la escena al cargarse. Se importan en cadena (`bench` → `scene`, `probe-tools` → `bench`, `overlays` → `probe-tools`) para que el orden de `scene.add` sea siempre el mismo.
4. **Los demás módulos solo declaran funciones** y registran eventos. No ejecutan lógica al cargarse.
5. **`lessonCheck` es el contrato con las lecciones.** Lee `S.joints`, `probeTools[i].contact`, `S.focus`, `S.meterMode` y `S.lessonMeasurement`. Esos campos deben seguir existiendo con el mismo significado.

## Error conocido conservado a propósito

`movement.js` → `rotateSelected` usa la variable `context`, que no existe. Esto produce un `ReferenceError` y la rotación no comprueba colisiones. Viene de la 1.0 (v16) y se corrige en el paso 3, con el nuevo sistema de colisiones.
