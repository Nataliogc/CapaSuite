# CapaSuite - Reglas y Directrices de Desarrollo

## 1. Control de Versiones Obligatorio y Automático
- **Regla estricta:** En CADA modificación, mejora o corrección realizada en el código de CapaSuite (archivos `.js`, `.html`, `.css`, etc.), se DEBE ejecutar automáticamente:
  ```bash
  node tools/bump-version.js
  ```
- Esto incrementa automáticamente el número de versión (SemVer patch), actualiza la fecha y hora de compilación en `js/version.js` y sincroniza las cadenas de cache-busting `?v=...` en los archivos HTML.
- El usuario siempre debe ver reflejada la versión más reciente en el badge superior (`.app-version-badge`) y en la consola.

## 2. Revenue Management & Pricing Intelligence (Multi-Hotel)
- **Sercotel Guadiana:** Capacidad de 108 habitaciones. Matriz de precios BAR 2027 base.
- **Cumbria Spa & Hotel:** Capacidad de 59 habitaciones. Matriz de precios BAR 2027 base calculada estrictamente restando 3 € a cada celda de Guadiana (84 combinaciones de mes y día de la semana).
- Escalado de ocupación orientativo Cumbria para Enero y Febrero:
  - 0–60%: 59 €
  - 61–70%: 67 €
  - 71–80%: 72 €
  - 81–90%: 82 €
  - 91–95%: 92 €
  - 96–100%: 107 €
- **Independencia Total:** Pickup, ocupación, histórico de reservas, competencia y recomendaciones se calculan de forma completamente separada e independiente para cada hotel.
- **Diferenciación Matemática vs Comercial:** No clasificar precios como «EN RANGO» basándose únicamente en tolerancias matemáticas ±5%. Si no hay histórico suficiente de pickup y el precio difiere de la BAR base, clasificar como `MANTENER — PENDIENTE DE EVALUACIÓN DE DEMANDA`.
- **Seguridad:** Las recomendaciones siempre requieren aprobación expresa del usuario. NUNCA enviar tarifas a Central de forma automática.
