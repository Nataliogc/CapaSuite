# 🚀 Hoja de Ruta — CapaSuite

## ✅ Completado (Refactor Estructural — Oct 2026)

- **CSS compartido**: `css/tokens.css` — fuente única de variables de diseño. Elimina 10 bloques `:root` duplicados.
- **Nav compartida**: `partials/nav.html` + `js/nav.js` — elimina 10 bloques de nav copiados y pegados.
- **Seguridad**: eliminadas credenciales hardcodeadas del formulario de login en `index.html`.
- **CapaState mejorado**: `CapaState.activeHotel` y `CapaState.setActiveHotel()` como punto único de acceso al hotel activo; dispara evento `hotel-changed`.
- **Storage**: reemplazado `window.name` (inseguro) por `sessionStorage` como fallback.
- **Organización de archivos**: scripts Python → `tools/`, tests → `tests/`, debug files → `_backup/`.

---

## 📋 Funcionalidades Pendientes

### 1. Monitor de Pick-up y Tendencias (Detección de Velocidad)
- **Concepto:** Análisis incremental — qué ha cambiado desde la última carga.
- **Objetivo:** Detectar aceleraciones o frenazos en la demanda por mes y segmento.
- **Alertas:** Indicadores visuales de "Acelera" / "Frena" y variaciones semanales.

### 2. Integración con Objetivos (Budget vs Real)
- **Concepto:** Comparar la Producción Real actual contra el Presupuesto 2026.
- **Objetivo:** Visualizar el cumplimiento de objetivos en tiempo real.
- **Visualización:** Barras de progreso y colores semafóricos (Rojo/Verde).

### 3. Mapa de Calor por Día de la Semana
- **Concepto:** Desglose de producción por día natural (Lunes a Domingo).
- **Objetivo:** Identificar patrones de consumo semanales.
- **Filtro:** Por servicio (ocupación vs producción SPA, etc.)

### 4. Limpieza pendiente (Q1 2027)
- Migración automática de fechas eliminada: leer datos ya no desplaza ni reescribe fechas.
- Evaluar migración de Firebase SDK v8 → v9 Modular.

---

*Última actualización: Oct 2026 — Refactor estructural por Antigravity*


## Correcciones de fiabilidad — 1 octubre 2026

- Las previsiones reemplazan los días incluidos en la carga, incluidos ceros y segmentos retirados, conservando el resto del calendario y el snapshot anterior.
- Las importaciones bloquean segmentos sin nombre y descuadres de habitaciones, ingresos desglosados y alojamiento. Agencias y Particulares siguen siendo segmentos admitidos, con prioridad de las correcciones explícitas.
- El ADR queda sin valor cuando falta un desglose verificable de alojamiento. Los resúmenes de producción no sustituyen un desglose existente.
- El almacenamiento conserva la versión nueva en sesión al superar la cuota persistente y avisa de la copia temporal.
- La sincronización incluye previsiones y mapeos; conserva una copia local y los cambios pendientes al cambiar de cuenta.
- El chat espera las respuestas asíncronas y escapa el texto antes de aplicar formato.
- La navegación reutiliza barras existentes, completa la portada y conserva el hotel seleccionado. Las vistas con navegación cargada esperan a que esté disponible.
- La PWA utiliza rutas relativas, conserva las cachés ajenas y excluye peticiones externas de su caché.
- Verificación automatizada local; las reglas desplegadas de Firebase y la conexión real de Gemini requieren comprobación con los servicios configurados.
