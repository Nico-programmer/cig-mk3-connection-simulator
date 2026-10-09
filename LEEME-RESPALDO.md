# Respaldo completo — versión 16

Copia exacta del código de la versión 16 restaurada y publicada el 8 de octubre de 2026.
Commit: 1ac33868678b977888dbbee634c973d3e371f607

Incluye HTML, JavaScript, CSS, dependencias locales de Three.js, licencia, configuración de hosting, pruebas, documentación y documentos e imágenes de referencia. No incluye los cambios de la versión 17 ni credenciales ni tokens. No necesita npm ni CDN para ejecutarse.

## Ejecutar localmente

Con Python 3 instalado, abre una terminal en esta carpeta y ejecuta:

    python3 -m http.server 8000 --directory dist

Abre http://localhost:8000 en un navegador con WebGL. No abras index.html mediante file://: los módulos JavaScript requieren un servidor HTTP.

## Pruebas

Con Node.js instalado, desde esta carpeta:

    node --test tests/circuit.test.mjs tests/learning.test.mjs tests/interaction.test.mjs tests/drag-performance.test.mjs

Las pruebas de interacción usan un renderizador simulado; no sustituyen la revisión visual en navegador. QA-NOTES.md detalla las optimizaciones y el fallo heredado de selección directa de una carcasa, pendiente en esta versión. README.md conserva el historial del proyecto.

SHA256SUMS.txt contiene las huellas de integridad de los archivos incluidos.
