# Evolución de CapaSuite para Revenue

## Primera fase: histórico y confianza en los datos

Disponible en **Seguimiento de Revenue**, desde Inicio y la navegación principal.

- Cargar Datos y Segmentos guardan una copia previa a la operación y una observación posterior a las cargas completadas.
- La ficha conserva archivo, tamaño, fecha de modificación, fecha de captura, periodo indicado y huella SHA-256 cuando el navegador puede calcularla.
- Las capturas se conservan por cuenta en IndexedDB. No se sustituyen por la última carga.
- La comparación diaria separa hoteles y tipos de fuente. Solo compara fechas presentes en las dos capturas y distingue cero explícito de dato desconocido.
- Los ingresos comparados son de alojamiento. Un importe total de departamentos no se convierte en alojamiento.
- Una carga fallida o cancelada conserva su copia previa, sin presentarse como una observación válida.
- Descargar copia completa incluye los datos activos y el histórico de la cuenta. Recuperar copia valida el archivo, guarda el estado previo e importa el histórico sin duplicar capturas ya conocidas.
- Recuperar una copia anterior afecta a los datos activos de ambos hoteles. La interfaz explica el alcance y pide confirmación antes de hacerlo.

### Uso diario

1. Importar los Excel habituales en Cargar Datos o Segmentos.
2. Abrir Seguimiento y elegir hotel, tipo de datos y dos capturas.
3. Filtrar por mes de estancia y revisar la cobertura antes de interpretar el pick-up.
4. Descargar periódicamente una copia completa, y siempre antes de cambiar de equipo o borrar los datos del navegador.

### Límites de esta fase

- El histórico y sus copias previas son locales al navegador y la cuenta. No se sincronizan automáticamente con Firebase; trasladarlos requiere exportación y recuperación.
- La captura registra el momento de importación. La fecha de modificación del archivo no se usa como fecha histórica de reserva ni como fecha de captura del PMS.
- Los informes agregados permiten medir cambio neto. No permiten separar reservas nuevas, cancelaciones y modificaciones, ni reconstruir curvas anteriores a las capturas guardadas.
- Una observación recoge el estado del conjunto de datos después de la carga. El nombre del archivo identifica la operación que la produjo; no acredita que todas las fechas guardadas procedan de ese único archivo.
- Los informes sin detalle diario dejan constancia de su carga, pero no generan comparaciones diarias inventadas.
- Guardar una captura manual no importa reservas ni certifica las cifras del PMS.
- Las cargas desde módulos distintos de Cargar Datos y Segmentos no crean automáticamente fichas de importación en esta fase. Se puede guardar una captura manual de los datos activos.
- Las copias incluyen los conjuntos de datos definidos en `CapaRevenueHistory.KEYS`; no incluyen contraseñas, claves de API, archivos Excel originales ni carpetas favoritas.
- Si el navegador no permite guardar la copia previa en IndexedDB, la importación registrada se detiene antes de procesar datos. No hay una política automática de borrado del histórico.

## Siguientes fases

1. **Validación operativa**: contrastar importaciones reales de ambos hoteles contra ocupación e ingresos del PMS. Ajustar formatos y registrar cobertura específica de cada archivo.
2. **Previsión diaria**: curvas por antelación, día de la semana, segmento y temporada; comparación homogénea con el año anterior; validación retrospectiva del error. Mostrar intervalos de incertidumbre y ausencia de histórico suficiente.
3. **Decisiones de precio**: configurar tarifas mínimas/máximas, reglas de disponibilidad y restricciones. Proponer acciones justificadas, sin enviar precios automáticamente.
4. **Margen neto**: introducir comisiones por canal y costes variables. Evaluar rentabilidad de segmentos y desplazamiento de grupos.
5. **Panel de prioridades**: fechas que necesitan atención, fundamento de cada propuesta y registro de decisiones y resultados.
6. **Integración PMS**: definir proveedor, exportaciones o API y campos de reserva disponibles; automatizar capturas solo cuando exista una conexión autorizada y comprobada.

Estas fases requieren histórico y reglas del negocio; la aplicación no presenta como disponibles modelos ni conexiones que todavía no se hayan implementado y validado.

## Verificación

- 79 pruebas automatizadas locales pasan, incluidas 12 de observaciones, cobertura, recuperación, aislamiento de cuentas y validación de copias.
- Prueba en navegador con dos Excel sintéticos: 5 → 8 habitaciones en una fecha y 2 → 0 en otra; resultado neto +1 habitación y +100 € de alojamiento.
- Comprobadas persistencia tras recarga, descarga de una copia JSON válida, recuperación de la copia anterior y recuperación del archivo descargado.
- No se han utilizado informes reales ni modificado datos de producción o publicado el sitio durante estas pruebas.
