# Módulos de la aplicación (versión 1.17)

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
| `movement.js` | Mover y rotar la selección (usa `colliders.js`). Un conector de arnés se detiene al alcance de su cable. |
| `colliders.js` | Colisión del hardware rígido (reconstruido en la 1.14). Las excepciones viven solo en `exempt()`. Movimiento con deslizamiento (`moveWithSlide`) y rotación comprobada (`rotateChecked`). |
| `cables.js` | Cables de los arneses (1.17): una cuerda `Rope` por arnés que sale por la parte trasera de ambos conectores, con los 4 hilos de color (rojo, negro, naranja, café) entre la carcasa y la funda. Largo `harnessLength`, máximo `HARNESS_MAX`, alcance `HARNESS_REACH`. |
| `probes.js` | Colocación y movimiento de las puntas (optimizado en la 1.13). Desde la 1.16, sus cables son cuerdas `Rope`: largo `leadLength`, máximo `LEAD_MAX`, alcance `LEAD_REACH`. |
| `rope.js` | Cable físico reutilizable (1.16): cadena de partículas con gravedad, colisión con el hardware rígido y las bandejas, largo sin estiramiento, reposo automático. Lo usarán también los arneses y el bypass. |
| `bypass.js` | Conectores y cables del bypass. **Paso 7.** |
| `view.js` | Enfoque de la vista y resguardo de la cámara (reconstruido en la 1.15): la cámara va donde la piden los controles y solo se desliza hacia el objetivo si ese punto queda dentro de un sólido. |
| `meter.js` | Lecturas, display y panel del multímetro. |
| `input.js` | Ratón, rueda, doble clic y panel de orientación. |
| `ui.js` | Panel de selección, idioma, teclado y textos. |
| `screens.js` | Pantalla del MK3. |
| `hitboxes.js` | Visualización de hitboxes. |
| `guidance.js` | Anillos y etiquetas de pines de las lecciones. |
| `loop.js` | Bucle de animación y cambio de tamaño de ventana. Llama a `restoreCameraDesired()` antes de `controls.update()` y a `updateLeads(dt)` y `updateHarnesses(dt)` en cada cuadro. |
| `learning-mount.js` | Monta la guía de lecciones (`../learning.js`). |
| `lessons-bridge.js` | `prepareLesson` y `lessonCheck`: lo que las lecciones leen del banco. |

Fuera de esta carpeta y sin cambios: `../electrical.js`, `../learning.js`, `../geometry.js`, `../collision.js`, `../drag-performance.js` y `../vendor/`.

## Reglas para modificar

1. **Un cambio, un módulo.** Si un arreglo obliga a tocar muchos módulos, primero hay que revisar el diseño.
2. **Estado compartido solo en `S`.** Una variable que otro módulo necesita reasignar va en `state.js`. Si solo se lee, se exporta desde su módulo.
3. **Los módulos de construcción no importan funciones de otros módulos.** Son `scene`, `bench`, `probe-tools` y `overlays`, y crean objetos y los añaden a la escena al cargarse. Se importan en cadena (`bench` → `scene`, `probe-tools` → `bench`, `overlays` → `probe-tools`) para que el orden de `scene.add` sea siempre el mismo.
4. **Los demás módulos solo declaran funciones** y registran eventos. No ejecutan lógica al cargarse.
5. **`lessonCheck` es el contrato con las lecciones.** Lee `S.joints`, `probeTools[i].contact`, `S.focus`, `S.meterMode` y `S.lessonMeasurement`. Esos campos deben seguir existiendo con el mismo significado.

## Reglas de colisión (desde 1.14)

- **Sólidos:** solo el hardware rígido, es decir, las mallas con `userData.solid`: MK3, EM, carcasas de conectores, conectores del bypass, llave, multímetro y puntas. Son unas 77 cajas.
- **Cables:** son flexibles y nunca bloquean. Hasta que se conviertan en cuerdas (pasos 5–7), una pieza puede pasar visualmente a través de un cable.
- **Excepciones (`exempt`):** dos conectores acoplados entre sí no chocan, y la punta no choca con el conector donde mide.
- **Puntas conectadas:** una punta conectada a un pin de la pieza que se mueve la acompaña y no la bloquea.
- **Mesa y cámara:** ninguna pieza baja de la mesa (y = −0,115). Una pieza arrastrada hacia la vista se detiene antes de entrar en la esfera de la cámara (radio 0,38); así la cámara no salta por detrás de lo que tienes en la mano.

## Reglas de la cámara (desde 1.15)

- Los controles de órbita guardan la posición *deseada*; `restoreCameraDesired()` se la devuelve en cada cuadro, así que el zoom nunca se desajusta.
- Si la posición deseada está libre, la cámara va exactamente ahí, aunque una pieza tape el punto mirado.
- Si la posición deseada queda dentro de un sólido (agrandado por el radio 0,38 de la cámara), la cámara se desliza por la línea hacia el punto mirado hasta quedar justo afuera. Si el punto mirado está dentro de ese mismo sólido, se coloca del otro lado.
- Usa un solo rayo por cuadro, con la distancia exacta entre la esfera y cada caja. No avanza por pasos, no se traba y no se teletransporta.
- **Rotación:** se aplica en incrementos de 3°. Si solo la mesa lo impide, la pieza se eleva para apoyarse; cualquier otro contacto cancela la rotación.
- **Piezas encimadas al inicio:** si una pieza ya está encimada al empezar a moverla, ese contacto se ignora durante ese movimiento para poder separarla.

## Cables físicos (`rope.js`, desde 1.16)

- **Modelo:** 64 partículas, gravedad real (1 unidad ≈ 5,6 cm), amortiguación, rigidez leve a la flexión y fricción. Los extremos y su primer tramo salen en línea recta del borne y de la punta.
- **Largo:** 1,25 × la distancia + 1,2, con mínimo de 3,5 y máximo de 24. El cable se recoge solo; si un obstáculo exige más cable de forma sostenida (0,25 s), se suelta lo necesario. Si una punta excede el alcance, se detiene: el cable nunca se estira.
- **Sin estiramiento:** una pasada de ida y vuelta, que también descuenta velocidad, elimina el estiramiento que produce la gravedad.
- **Colisión:** contra el hardware rígido y las bandejas (cajas sólidas). La partícula sale por la cara por la que entró, la de menor empujón, así que no cruza losas delgadas; los escalones más bajos que el radio los sube.
- **Protecciones contra lazos:**
  - subpasos fijos de 1/120 s y cuadro limitado a 1/30 s;
  - más subpasos cuando un extremo se mueve rápido;
  - si un extremo salta más de 2,5, el cable se tiende de nuevo por arriba y cae;
  - si aparece un valor inválido o el cable se descontrola, se reinicia.
- **Enganches (desde 1.17):** si el estiramiento se concentra en un solo segmento (una partícula atrapada entre dos sólidos), el cable no suelta más largo. Ese par de partículas deja de chocar durante 0,25 s y el cable se zafa.
- **Espacio local:** la cuerda se dibuja en el espacio local del grupo que la contiene, así que puede colgar dentro de un arnés que se mueve.
- **Reposo:** cuando nada se mueve más de 0,3 mm por cuadro durante 20 cuadros, el cable se duerme y no consume tiempo.
