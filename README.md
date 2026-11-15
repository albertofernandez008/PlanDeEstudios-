# Organización de Parciales — versión personal v16

Aplicación local de planificación y estudio. Abre `index.html` en un navegador moderno.

## Novedades v13
- Historial persistente de autoevaluaciones y correcciones IA por tema, con fecha, nota, procedencia y feedback.
- Las correcciones y autoevaluaciones alimentan las recomendaciones de temas débiles y la planificación semanal.
- La planificación asigna más minutos a temas con resultados recientes bajos.
- Las sesiones Focus pueden asociarse a un tema concreto; la actividad de los últimos 14 días influye moderadamente en la prioridad para evitar repetir innecesariamente un tema recién practicado.
- El historial de evaluaciones se incluye en exportaciones e importaciones de copias de seguridad.

## Novedades v12
- OCR para imágenes PNG/JPG/WebP y para PDF escaneados sin texto seleccionable.
- En PDF escaneados, el OCR procesa como máximo las primeras 12 páginas por operación para limitar el tiempo de espera.
- El OCR utiliza Tesseract.js con español e inglés y requiere conexión para cargar la biblioteca y los modelos.
- Plan semanal adaptativo basado en temas pendientes, dominio declarado y fecha de próximo repaso.
- Tarjetas del plan semanal que se pueden arrastrar entre días; el plan se guarda en `localStorage` y se incluye en la copia de seguridad.
- Recomendaciones que destacan repasos vencidos y temas con menor dominio.
- Nuevo modo de tutor socrático.
- Dificultad configurable (básica, media, alta o universitaria) para tests y preguntas de examen.


## Novedades v16
- Rediseño profundo del panel «Hoy» como centro de estudio: prioridades accionables, resumen diario/semanal, próximos exámenes, ritmo de estudio, carga estimada y estado de cada asignatura.
- La cola de prioridades permite abrir Focus con asignatura y tema seleccionados.
- Cada examen muestra temas pendientes y un indicador orientativo de preparación. El indicador combina temario completado (45%), dominio declarado (35%) y evaluaciones recientes (20%); si no hay evaluaciones, normaliza los pesos disponibles. No predice la nota del examen.
- La carga pendiente suma los minutos estimados de los temas no completados. El ritmo semanal usa sesiones registradas de los últimos siete días.
- Se mantienen las herramientas, el plan diario anterior y el almacenamiento local existentes.

## Límites v16
- El indicador de preparación es una heurística descriptiva, no una predicción académica validada. El dominio es autodeclarado y la calidad depende de los datos registrados.
- Las horas pendientes son la suma de estimaciones que hayas asignado a los temas; no equivalen necesariamente al tiempo real que necesitarás.
- La actividad y el progreso reflejan sesiones y evaluaciones registradas en este navegador.

## Novedades v15
- El inicio «Hoy» incorpora un centro de mando que combina el temario personal, repasos vencidos, flashcards pendientes, historial de evaluaciones y sesiones Focus.
- Recomendación prioritaria calculada con las reglas existentes de temas débiles, repasos y actividad reciente; muestra el motivo y permite saltar a la herramienta correspondiente.
- Cuenta atrás de los tres próximos exámenes definidos en las fechas de las asignaturas, junto con los temas todavía abiertos.
- Accesos rápidos a Focus, Biblioteca IA y Progreso; desde una recomendación de tema se abre Focus con asignatura y tema preseleccionados.
- Se conserva debajo el plan diario anterior: el nuevo panel amplía la vista «Hoy» sin eliminar las tareas y controles existentes.

## Novedades v14
- Conversaciones persistentes por documento para los modos de duda, explicación y tutor socrático; conserva hasta 24 mensajes por apunte y envía los últimos 12 turnos como contexto a Gemini.
- Disponibilidad configurable por día de la semana (0–720 minutos) y duración máxima por sesión (25–180 minutos).
- El plan semanal distribuye temas pendientes respetando la disponibilidad y la duración máxima indicada; puede dejar temas sin programar si no hay capacidad suficiente.
- Panel de evolución de las últimas seis semanas con minutos estudiados y media de evaluaciones.
- Las conversaciones y la configuración semanal se incluyen en copias de seguridad e importaciones.

## Límites v14
- La conversación se conserva localmente por documento; no se sincroniza entre dispositivos. Gemini recibe el texto del documento y los últimos turnos enviados.
- La planificación es una heurística por prioridades y capacidad diaria; no estima con precisión el esfuerzo cognitivo ni garantiza cubrir todos los temas.
- La gráfica muestra los datos registrados, por lo que una semana sin evaluaciones aparece sin nota, no como cero.

## Funcionamiento y límites
- El planificador semanal es una propuesta heurística local, no una predicción del tiempo real que necesita cada tema.
- El modo socrático genera una intervención guiada por turno; no mantiene todavía una conversación persistente con memoria automática de turnos anteriores.
- El OCR puede cometer errores, especialmente con letra manuscrita, fotos inclinadas o baja resolución. Revisa el texto extraído antes de usarlo con IA.
- Las funciones de IA requieren una clave Gemini válida y conexión a Internet. El texto seleccionado se envía a Google Gemini cuando solicitas una actividad.
- La mayoría de funciones guardan datos en `localStorage` de este navegador.
- No se ha conectado ni modificado Supabase.

## Límites v13
- La nota de autoevaluación es una señal subjetiva; no equivale a una corrección objetiva.
- Las correcciones IA pueden contener errores y deben revisarse.
- El historial usa como máximo tres evaluaciones recientes por tema para calcular la media de referencia.
- La actividad Focus solo se vincula a un tema cuando se selecciona expresamente antes de iniciar la sesión.
- La planificación sigue siendo una heurística local, no una predicción científica del aprendizaje.

## Pruebas
46 pruebas automáticas cubren la lógica de planificación, disponibilidad, conversaciones, evolución académica y el modelo agregado del nuevo panel de estudio. Ejecuta `node --test logic.test.mjs` desde esta carpeta.
