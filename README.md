# Organización de Parciales — versión personal v12

Aplicación local de planificación y estudio. Abre `index.html` en un navegador moderno.

## Novedades v12
- OCR para imágenes PNG/JPG/WebP y para PDF escaneados sin texto seleccionable.
- En PDF escaneados, el OCR procesa como máximo las primeras 12 páginas por operación para limitar el tiempo de espera.
- El OCR utiliza Tesseract.js con español e inglés y requiere conexión para cargar la biblioteca y los modelos.
- Plan semanal adaptativo basado en temas pendientes, dominio declarado y fecha de próximo repaso.
- Tarjetas del plan semanal que se pueden arrastrar entre días; el plan se guarda en `localStorage` y se incluye en la copia de seguridad.
- Recomendaciones que destacan repasos vencidos y temas con menor dominio.
- Nuevo modo de tutor socrático.
- Dificultad configurable (básica, media, alta o universitaria) para tests y preguntas de examen.

## Funcionamiento y límites
- El planificador semanal es una propuesta heurística local, no una predicción del tiempo real que necesita cada tema.
- El modo socrático genera una intervención guiada por turno; no mantiene todavía una conversación persistente con memoria automática de turnos anteriores.
- El OCR puede cometer errores, especialmente con letra manuscrita, fotos inclinadas o baja resolución. Revisa el texto extraído antes de usarlo con IA.
- Las funciones de IA requieren una clave Gemini válida y conexión a Internet. El texto seleccionado se envía a Google Gemini cuando solicitas una actividad.
- La mayoría de funciones guardan datos en `localStorage` de este navegador.
- No se ha conectado ni modificado Supabase.

## Pruebas
Ejecuta `node --test logic.test.mjs` desde esta carpeta.
