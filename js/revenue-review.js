/* Review observed changes; no demand forecasts or automatic price decisions. */
(function (root) {
    'use strict';
    function attention(comparison, mode, today) {
        if (!comparison.available || mode !== 'forecast') return [];
        return comparison.rows.filter(row => row.iso >= today &&
            (row.roomsDelta < 0 || row.accommodationDelta != null && row.accommodationDelta < 0))
            .sort((a, b) => a.iso.localeCompare(b.iso));
    }
    function csv(comparison, previous, current, changesOnly = false) {
        if (!comparison.available) throw new Error('No hay una comparación disponible para descargar.');
        const cell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
        const rows = [['Hotel', 'Tipo', 'Captura anterior', 'Captura actual', 'Fecha estancia', 'Habitaciones antes', 'Habitaciones ahora', 'Cambio habitaciones', 'Cambio alojamiento EUR']];
        for (const row of comparison.rows) {
            if (changesOnly && row.roomsDelta === 0 && (row.accommodationDelta == null || row.accommodationDelta === 0)) continue;
            rows.push([current.hotel, current.mode === 'forecast' ? 'Previsión' : 'Producción', previous.capturedAt, current.capturedAt,
                row.iso, row.previousRooms, row.rooms, row.roomsDelta,
                row.accommodationDelta == null ? '' : String(row.accommodationDelta).replace('.', ',')]);
        }
        return '\uFEFF' + rows.map(row => row.map(cell).join(';')).join('\r\n');
    }
    const api = { attention, csv };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.CapaRevenueReview = api;
})(typeof window !== 'undefined' ? window : globalThis);
