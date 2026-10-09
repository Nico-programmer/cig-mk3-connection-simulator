# MK3 Lab — versión 1.19

Proyecto completo del simulador con su historial git (una etiqueta por versión, de 1.0 a 1.19). La 1.0 es la v16 original de Astra; las versiones 1.x reconstruyeron las colisiones, la cámara y los cables sin cambiar la parte eléctrica, las lecciones ni el multímetro.

Incluye HTML, JavaScript, CSS, Three.js local con su licencia, configuración de hosting, pruebas, documentación y los documentos e imágenes de referencia. No necesita npm ni CDN para ejecutarse.

## Ejecutar localmente

Con Python 3 instalado, abre una terminal en esta carpeta y ejecuta:

    python3 -m http.server 8000 --directory dist

Abre http://localhost:8000 en un navegador con WebGL. No abras index.html mediante file://: los módulos JavaScript requieren un servidor HTTP.

## Pruebas

Con Node.js 20 o superior, desde esta carpeta, las 12 suites de una en una:

    node --test --test-concurrency=1 tests/*.test.mjs

O una sola, por ejemplo `node tests/rope.test.mjs`. Ejecutarlas en paralelo puede agotar la memoria en equipos pequeños. Las pruebas usan un renderizador simulado: no sustituyen la revisión visual en el navegador.

## Documentación

- `README.md`: estado actual ("Current state") y una sección por versión con lo que cambió y cómo se comprobó.
- `dist/app/README.md`: mapa de módulos y reglas para modificarlos sin romper nada (colisión, cámara, cables).
- `QA-NOTES.md`: notas de la v16, solo como historial.
- `SHA256SUMS.txt`: huellas de integridad de los archivos incluidos.
