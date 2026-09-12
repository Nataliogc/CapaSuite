/* Shared, side-effect-free import and calculations for segment reports. */
(function (root) {
    'use strict';
    const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.]/g, '').trim();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const aliases = { CORPORATI: 'CORPORATIVO LINEAL', 'DIRECTO O': 'DIRECTO OFFLINE', 'TTOO DINA': 'TTOO DINAMICA', PARTICULA: 'PARTICULARES' };
    const fields = ['revenue', 'rooms', 'accommodation', 'totalRevenue'];
    const empty = name => ({ name, ...Object.fromEntries(fields.map(k => [k, Array(12).fill(0)])) });
    function number(value) {
        if (value == null || String(value).trim() === '' || value === '-') return 0;
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        let s = String(value).replace(/[€\s\u00a0]/g, '');
        const negative = /^\(.*\)$/.test(s);
        s = s.replace(/[()]/g, '');
        if (s.includes(',')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
        if (!/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(s)) throw new Error('Importe no válido: ' + value);
        return Number(s) * (negative ? -1 : 1);
    }
    function column(value, hintYear) {
        let d;
        if (value instanceof Date) d = value;
        else if (typeof value === 'number' && value > 40000 && value < 80000) d = new Date(Date.UTC(1899, 11, 30) + Math.round(value) * 86400000);
        if (d) return { year: String(d.getUTCFullYear()), month: d.getUTCMonth(), day: d.getUTCDate() };
        const text = String(value ?? '').trim();
        const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
        if (match) {
            const year = match[3].length === 2 ? '20' + match[3] : match[3];
            const month = Number(match[2]) - 1, day = Number(match[1]);
            const date = new Date(Date.UTC(Number(year), month, day));
            if (date.getUTCMonth() !== month || date.getUTCDate() !== day) throw new Error('Fecha no válida: ' + text);
            return { year, month, day };
        }
        const m = norm(text).match(/^([A-Z]+)(?:[ /-]?(\d{4}|\d{2}))?$/);
        const monthName = m ? ({ JAN: 'ENE', APR: 'ABR', AUG: 'AGO', DEC: 'DIC' }[m[1].slice(0, 3)] || m[1].slice(0, 3)) : '';
        const idx = months.indexOf(monthName);
        if (idx >= 0) {
            const year = m[2] ? (m[2].length === 2 ? '20' + m[2] : m[2]) : hintYear;
            if (year) return { year: String(year), month: idx, day: null };
        }
        return null; // Period totals and percentage columns are deliberately excluded.
    }
    function parse(rows, fileName = '', hintYear) {
        const dateHint = fileName.match(/\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2})/);
        hintYear = dateHint ? (dateHint[1].length === 2 ? '20' + dateHint[1] : dateHint[1]) : hintYear;
        let header = -1, columns = [];
        for (let r = 0; r < Math.min(rows.length, 30); r++) {
            const mapped = (rows[r] || []).map((v, c) => c < 2 ? null : column(v, hintYear));
            if (mapped.some(Boolean) && rows.slice(r + 1, r + 6).some(row => /^(HAB|RN|RMS|NOCHES)$/.test(norm(row?.[1])))) {
                header = r; columns = mapped; break;
            }
        }
        if (header < 0) throw new Error('No se reconoce la cabecera de fechas y habitaciones del informe.');
        // Prefer daily columns if the report also contains monthly summaries.
        const dailyKeys = new Set(columns.filter(c => c?.day).map(c => c.year + '-' + c.month));
        columns = columns.map(c => c && !c.day && dailyKeys.has(c.year + '-' + c.month) ? null : c);
        const unique = new Set(), years = {};
        columns.forEach(c => {
            if (!c) return;
            const key = `${c.year}-${c.month}-${c.day}`;
            if (unique.has(key)) throw new Error('Fecha duplicada en la cabecera: ' + key);
            unique.add(key);
            const y = years[c.year] ||= { segment: {}, coverage: {}, controls: {}, detailed: true };
            const days = y.coverage[c.month] ||= [];
            if (c.day) days.push(c.day);
            else for (let day = 1; day <= new Date(Date.UTC(Number(c.year), c.month + 1, 0)).getUTCDate(); day++) days.push(day);
        });
        let segment = 'SIN SEGMENTO', afterBlank = false, totalBlock = false, roomRows = 0, lodgingRows = 0;
        for (let r = header + 1; r < rows.length; r++) {
            const row = rows[r] || [], rawName = String(row[0] ?? '').trim(), metric = norm(row[1]);
            if (!rawName && !metric && !columns.some((c, i) => c && row[i] != null && String(row[i]).trim() !== '')) { afterBlank = true; continue; }
            const isRooms = /^(HAB|RN|RMS|NOCHES|HABITACIONES|UNIDADES)$/.test(metric);
            if (rawName) {
                totalBlock = /^(TOTAL|TOTAL GENERAL|TOTAL MASTER|RESUMEN)$/.test(norm(rawName));
                segment = totalBlock ? null : (aliases[norm(rawName)] || rawName.toUpperCase());
            } else if (afterBlank && isRooms) { totalBlock = true; segment = null; }
            afterBlank = false;
            if (!metric || (!segment && !totalBlock)) continue;
            const isTotal = /^(PRO|PROD|PRODUCCION|REVENUE|VENTA|VTA)$/.test(metric);
            const isLodging = /HABITACION|ALOJAMIENTO|SUITE|CAMA SUPLETORIA|LATE CHECK OUT|AMPLIACION|RECARGO GDS|REGARGO GDS/.test(metric) || /^(DIA|NOCHE|INDIVIDUAL|DOBLE)$/.test(metric);
            const isBreakfast = metric.includes('DESAYUNO');
            if (isLodging && !totalBlock) lodgingRows++;
            if (!isRooms && !isTotal && !isLodging && !isBreakfast) continue;
            if (isRooms && !totalBlock) roomRows++;
            columns.forEach((c, i) => {
                if (!c) return;
                const y = years[c.year], value = number(row[i]);
                const target = totalBlock ? (y.controls.values ||= empty('TOTAL')) : (y.segment[segment] ||= empty(segment));
                if (isRooms) target.rooms[c.month] += value;
                else if (isTotal) target.totalRevenue[c.month] += value;
                else {
                    target.revenue[c.month] += value;
                    if (isLodging) target.accommodation[c.month] += value;
                }
                if (totalBlock) y.controls.present = true;
            });
        }
        if (!roomRows) throw new Error('El informe no contiene segmentos con una fila de habitaciones.');
        if (!lodgingRows) throw new Error('Falta el desglose de alojamiento. Importa el informe detallado para calcular producción, ADR y RevPAR.');
        for (const y of Object.values(years)) {
            for (const [m, days] of Object.entries(y.coverage)) {
                days.sort((a, b) => a - b);
                if (y.controls.present) for (const field of fields) {
                    const actual = Object.values(y.segment).reduce((s, seg) => s + seg[field][m], 0);
                    if (Math.abs(actual - y.controls.values[field][m]) > (field === 'rooms' ? 0 : 0.05)) throw new Error(`El total de ${field} no cuadra con los segmentos. Revisa el bloque de totales del archivo.`);
                }
            }
        }
        return { years, source: fileName };
    }
    function merge(db, hotel, report) {
        db[hotel] ||= {};
        for (const [year, incoming] of Object.entries(report.years)) {
            const target = db[hotel][year] ||= { service: {}, segment: {} };
            target.segment ||= {};
            target.segmentCoverage ||= {};
            target.segmentSources ||= {};
            for (const m of Object.keys(incoming.coverage)) {
                for (const seg of Object.values(target.segment)) for (const field of fields) if (seg[field]) seg[field][m] = 0;
                for (const [name, seg] of Object.entries(incoming.segment)) {
                    // Define own keys, including unusual names supplied by external reports.
                    if (!Object.hasOwn(target.segment, name)) Object.defineProperty(target.segment, name, { value: empty(name), writable: true, enumerable: true, configurable: true });
                    for (const field of fields) { target.segment[name][field] ||= Array(12).fill(0); target.segment[name][field][m] = seg[field][m]; }
                }
                target.segmentCoverage[m] = incoming.coverage[m];
                target.segmentSources[m] = report.source;
            }
            target.segmentUpdatedAt = new Date().toISOString();
        }
        return Object.keys(report.years).sort().reverse();
    }
    const segments = data => Object.values(data?.segment || {}).filter(s => !/^(TOTAL|TOTAL_MASTER|TOTAL MASTER)$/.test(norm(s.name)));
    const availableMonths = data => Array.from({ length: 12 }, (_, i) => i).filter(i => data?.segmentCoverage?.[i] || segments(data).some(s => Number(s.revenue?.[i]) !== 0 && s.revenue?.[i] != null || Number(s.rooms?.[i]) !== 0 && s.rooms?.[i] != null));
    const sum = (s, field, selected) => selected.reduce((n, m) => n + (Number(s?.[field]?.[m]) || 0), 0);
    function aggregate(data, selected) {
        const detailed = selected.length > 0 && selected.every(m => data?.segmentCoverage?.[m]);
        const result = { revenue: 0, rooms: 0, accommodation: detailed ? 0 : null, days: detailed ? selected.reduce((n, m) => n + data.segmentCoverage[m].length, 0) : null };
        for (const s of segments(data)) { result.revenue += sum(s, 'revenue', selected); result.rooms += sum(s, 'rooms', selected); if (detailed) result.accommodation += sum(s, 'accommodation', selected); }
        result.adr = detailed && result.rooms > 0 ? result.accommodation / result.rooms : null;
        return result;
    }
    function comparable(a, b, selected) {
        return selected.length > 0 && selected.every(m => a?.segmentCoverage?.[m] && b?.segmentCoverage?.[m] && JSON.stringify(a.segmentCoverage[m]) === JSON.stringify(b.segmentCoverage[m]));
    }
    const api = { parse, merge, aggregate, comparable, availableMonths, segments, sum, number };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SegmentAnalysis = api;
})(typeof window === 'undefined' ? globalThis : window);
