/* Shared, side-effect-free import and calculations for segment reports. */
(function (root) {
    'use strict';
    const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.]/g, '').trim();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const aliases = { CORPORATI: 'CORPORATIVO LINEAL', 'DIRECTO O': 'DIRECTO OFFLINE', 'TTOO DINA': 'TTOO DINAMICA' };
    const validSegments = ['CORPORATIVO LINEAL', 'DIRECTO OFFLINE', 'DIRONLINE', 'GRTANTEO', 'GRUPOS', 'OTA/AAVV', 'OTROS', 'TTOO DINAMICA'];
    const isRoomMetric = value => /^(HAB|HABI|RN|RMS|NOCHES|HABITACIONES|UNIDADES)$/.test(norm(value));
    const canonical = value => aliases[norm(value)] || norm(value);
    const isTotalName = value => /^(TOTAL|TOTAL GENERAL|TOTAL MASTER|RESUMEN)$/.test(norm(value));
    function reviewRows(rows, corrections = {}) {
        return rows.flatMap((row, index) => {
            if (!isRoomMetric(row?.[1])) return [];
            const cell = 'A' + (index + 1), original = String(row[0] ?? '').trim();
            const value = Object.hasOwn(corrections, cell) ? corrections[cell] : original;
            const name = canonical(value);
            const reason = !name ? 'Falta el segmento a la izquierda de Hab.' : !validSegments.includes(name) && !isTotalName(name) ? 'Segmento no válido. Debes asignarlo a un segmento correcto.' : '';
            return [{ cell, row: index + 1, original, name, reason }];
        });
    }
    const fields = ['revenue', 'rooms', 'accommodation', 'totalRevenue'];
    const empty = name => ({ name, concepts: {}, ...Object.fromEntries(fields.map(k => [k, Array(12).fill(0)])) });
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
        const shortDate = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
        if (shortDate) {
            if (!hintYear) throw new Error('La cabecera contiene días y meses sin año. Indica un periodo de un solo año o incluye el año en el nombre del archivo.');
            return column(`${shortDate[1]}/${shortDate[2]}/${hintYear}`, hintYear);
        }
        const toFullYear = y => y.length === 2 ? (Number(y) > 50 ? '19' : '20') + y : y;
        
        const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/);
        if (match) {
            const year = toFullYear(match[3]);
            const month = Number(match[2]) - 1, day = Number(match[1]);
            const date = new Date(Date.UTC(Number(year), month, day));
            if (date.getUTCMonth() !== month || date.getUTCDate() !== day) throw new Error('Fecha no válida: ' + text);
            return { year, month, day };
        }
        const m = norm(text).match(/^([A-Z]+)(?:[ /-]?(\d{4}|\d{2}))?$/);
        const monthName = m ? ({ JAN: 'ENE', APR: 'ABR', AUG: 'AGO', DEC: 'DIC' }[m[1].slice(0, 3)] || m[1].slice(0, 3)) : '';
        const idx = months.indexOf(monthName);
        if (idx >= 0) {
            const year = m[2] ? toFullYear(m[2]) : hintYear;
            if (year) return { year: String(year), month: idx, day: null };
        }
        return null; // Period totals and percentage columns are deliberately excluded.
    }
    function parse(rows, fileName = '', hintYear, corrections = {}) {
        const dateYears = [...fileName.matchAll(/\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2})(?!\d)/g)].map(m => m[1].length === 2 ? (Number(m[1]) > 50 ? '19' : '20') + m[1] : m[1]);
        const periodYears = String(hintYear || '').match(/\b20\d{2}\b/g) || [];
        const uniqueYears = [...new Set(periodYears.length ? periodYears : dateYears)];
        hintYear = uniqueYears.length === 1 ? uniqueYears[0] : undefined;
        let header = -1, columns = [];
        for (let r = 0; r < Math.min(rows.length, 30); r++) {
            const mapped = (rows[r] || []).map((v, c) => c < 2 ? null : column(v, hintYear));
            if (mapped.some(Boolean) && rows.slice(r + 1, r + 6).some(row => isRoomMetric(row?.[1]))) {
                header = r; columns = mapped; break;
            }
        }
        if (header < 0) throw new Error('No se reconoce la cabecera de fechas y habitaciones del informe.');
        const blocks = reviewRows(rows, corrections), issues = blocks.filter(block => block.reason);
        if (issues.length) {
            const error = new Error('Revisa los segmentos: ' + issues.map(b => `${b.cell}: ${b.reason}`).join(' '));
            error.code = 'SEGMENT_REVIEW'; error.issues = issues; error.blocks = blocks;
            throw error;
        }
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
        let segment = null, totalBlock = false, roomRows = 0, lodgingRows = 0;
        for (let r = header + 1; r < rows.length; r++) {
            const row = rows[r] || [], rawName = String(row[0] ?? '').trim(), metric = norm(row[1]);
            const isRooms = isRoomMetric(metric);
            if (isRooms) {
                const block = blocks.find(b => b.row === r + 1);
                totalBlock = isTotalName(block.name);
                segment = totalBlock ? null : block.name;
            }
            if (!metric || (!segment && !totalBlock)) continue;
            const isTotal = /\b(PRO|PROD|PRODUCCIO?N|REVENUE|VENTA|VTA|INGRESOS?|TOTAL|TOTALES|NETO|IMPORTE)\b/.test(metric);
            const isLodging = /HABITACI|ALOJAMIENTO|ALOJAM|SUITE|CAMA SUPLETORIA|LATE CHECK OUT|AMPLIACION|RECARGO|REGARGO|\b(DIA|NOCHE|INDIVIDUAL|DOBLE)\b/.test(metric);
            const isBreakfast = /DESAYUNO|PENSI|BUFFET/.test(metric);
            const isNonMoney = /PAX|ADULTOS|NIÑOS|BEBES|CUNAS|OCUPACION|PORCENTAJE|%|DIAS|ESTANCIAS|EDAD/.test(metric);
            if (isLodging && !totalBlock) lodgingRows++;
            if (isNonMoney) continue;
            if (isRooms && !totalBlock) roomRows++;
            columns.forEach((c, i) => {
                if (!c) return;
                const y = years[c.year], value = number(row[i]);
                const target = totalBlock ? (y.controls.values ||= empty('TOTAL')) : (y.segment[segment] ||= empty(segment));
                
                if (isRooms) target.rooms[c.month] += value;
                else if (isTotal) target.totalRevenue[c.month] += value;
                else {
                    target.concepts ||= {};
                    const safeMetric = metric || 'DESCONOCIDO';
                    target.concepts[safeMetric] ||= Array(12).fill(0);
                    target.concepts[safeMetric][c.month] += value;
                    
                    target.revenue[c.month] += value;
                    if (isLodging) target.accommodation[c.month] += value;
                }
                if (totalBlock) y.controls.present = true;
            });
        }
        if (!roomRows) throw new Error('El informe no contiene segmentos con una fila de habitaciones.');
        
        for (const y of Object.values(years)) {
            const processFallback = (target) => {
                if (!target) return;
                const revSum = target.revenue.reduce((a, b) => a + b, 0);
                const totSum = target.totalRevenue.reduce((a, b) => a + b, 0);
                const accSum = target.accommodation.reduce((a, b) => a + b, 0);
                
                if (Math.abs(totSum) > Math.abs(revSum)) {
                    for (let i = 0; i < 12; i++) {
                        target.revenue[i] = target.totalRevenue[i];
                    }
                }
                
                if (accSum === 0 && target.revenue.reduce((a, b) => a + b, 0) !== 0) {
                    for (let i = 0; i < 12; i++) {
                        target.accommodation[i] = target.revenue[i];
                    }
                }
            };
            if (y.controls.present) processFallback(y.controls.values);
            for (const s of Object.values(y.segment)) processFallback(s);
            
            for (const [m, days] of Object.entries(y.coverage)) {
                days.sort((a, b) => a - b);
                if (y.controls.present) for (const field of fields) {
                    const actual = Object.values(y.segment).reduce((s, seg) => s + seg[field][m], 0);
                    if (Math.abs(actual - y.controls.values[field][m]) > (field === 'rooms' ? 0 : 0.05)) console.warn(`El total de ${field} no cuadra con los segmentos. Revisa el bloque de totales del archivo.`);
                }
            }
        }
        return { years, source: fileName, corrections: blocks.filter(b => b.original !== b.name).map(b => ({ cell: b.cell, original: b.original, segment: b.name })) };
    }
    function merge(db, hotel, report) {
        db[hotel] ||= {};
        for (const [year, incoming] of Object.entries(report.years)) {
            const target = db[hotel][year] ||= { service: {}, segment: {} };
            target.segment ||= {};
            target.segmentCoverage ||= {};
            target.segmentSources ||= {};
            target.segmentCorrections ||= {};
            for (const m of Object.keys(incoming.coverage)) {
                for (const seg of Object.values(target.segment)) {
                    for (const field of fields) if (seg[field]) seg[field][m] = 0;
                    if (seg.concepts) {
                        for (const concept of Object.values(seg.concepts)) concept[m] = 0;
                    }
                }
                for (const [name, seg] of Object.entries(incoming.segment)) {
                    // Define own keys, including unusual names supplied by external reports.
                    if (!Object.hasOwn(target.segment, name)) Object.defineProperty(target.segment, name, { value: empty(name), writable: true, enumerable: true, configurable: true });
                    for (const field of fields) { target.segment[name][field] ||= Array(12).fill(0); target.segment[name][field][m] = seg[field][m]; }
                    
                    target.segment[name].concepts ||= {};
                    if (seg.concepts) {
                        for (const [cName, cArr] of Object.entries(seg.concepts)) {
                            target.segment[name].concepts[cName] ||= Array(12).fill(0);
                            target.segment[name].concepts[cName][m] = cArr[m];
                        }
                    }
                }
                target.segmentCoverage[m] = incoming.coverage[m];
                target.segmentSources[m] = report.source;
                target.segmentCorrections[m] = report.corrections || [];
            }
            target.segmentUpdatedAt = new Date().toISOString();
        }
        return Object.keys(report.years).sort().reverse();
    }
    function parseForecast(rows, fileName = '') {
        const yearMatches = [...fileName.matchAll(/\d{4}/g)].map(m => Number(m[0]));
        const startYear = yearMatches.length > 0 ? yearMatches[0] : new Date().getFullYear();

        let header = -1, columns = [];
        for (let r = 0; r < Math.min(rows.length, 30); r++) {
            const mapped = (rows[r] || []).map((v, c) => {
                if (c < 2) return null;
                const text = String(v ?? '').trim();
                const shortDate = text.match(/^(\d{1,2})[/-](\d{1,2})$/);
                if (shortDate) return { month: Number(shortDate[2]) - 1, day: Number(shortDate[1]) };
                return null;
            });
            if (mapped.some(Boolean) && rows.slice(r + 1, r + 6).some(row => /^(HAB|HABI|RN|RMS|NOCHES|HABITACIONES|UNIDADES)$/.test(norm(row?.[1])))) {
                header = r; columns = mapped; break;
            }
        }
        if (header < 0) throw new Error('No se reconoce la cabecera de fechas diarias (DD/MM) en el informe.');

        let currentYear = startYear;
        let lastMonth = -1;
        columns = columns.map(c => {
            if (!c) return null;
            if (lastMonth !== -1 && c.month < lastMonth) currentYear++;
            lastMonth = c.month;
            return { iso: `${currentYear}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}` };
        });

        const blocks = reviewRows(rows, {});
        const segmentData = {};

        for (const block of blocks) {
            const segment = block.name;
            if (/^(TOTAL|TOTAL GENERAL|TOTAL MASTER|RESUMEN)$/.test(norm(segment))) continue;
            
            const target = segmentData[segment] ||= { name: segment, days: {} };
            let roomRows = 0, lodgingRows = 0;

            for (let r = block.row; r <= block.end; r++) {
                const row = rows[r], metric = String(row?.[1] || '').toUpperCase();
                if (!metric) continue;

                const isRooms = /^(HAB|HABI|RN|RMS|NOCHES|HABITACIONES|UNIDADES)$/.test(norm(metric));
                const isTotal = /\b(PRO|PROD|PRODUCCIO?N|REVENUE|VENTA|VTA|INGRESOS?|TOTAL|TOTALES|NETO|IMPORTE)\b/.test(metric);
                const isLodging = /HABITACI|ALOJAMIENTO|ALOJAM|SUITE|CAMA SUPLETORIA|LATE CHECK OUT|AMPLIACION|RECARGO|REGARGO|\b(DIA|NOCHE|INDIVIDUAL|DOBLE)\b/.test(metric);
                const isNonMoney = /PAX|ADULTOS|NIÑOS|BEBES|CUNAS|OCUPACION|PORCENTAJE|%|DIAS|ESTANCIAS|EDAD/.test(metric);

                if (isLodging) lodgingRows++;
                if (isNonMoney) continue;
                if (isRooms) roomRows++;

                columns.forEach((c, i) => {
                    if (!c) return;
                    const value = number(row[i]);
                    if (value === 0) return;
                    
                    const dt = target.days[c.iso] ||= { revenue: 0, rooms: 0, accommodation: 0, totalRevenue: 0 };
                    
                    if (isRooms) dt.rooms += value;
                    else if (isTotal) dt.totalRevenue += value;
                    else {
                        dt.revenue += value;
                        if (isLodging) dt.accommodation += value;
                    }
                });
            }
            
            // Fallback for each day
            for (const dt of Object.values(target.days)) {
                if (Math.abs(dt.totalRevenue) > Math.abs(dt.revenue)) {
                    dt.revenue = dt.totalRevenue;
                }
                if (dt.accommodation === 0 && dt.revenue !== 0 && lodgingRows === 0) {
                    dt.accommodation = dt.revenue;
                }
            }
        }
        return { segmentData, source: fileName, startYear };
    }

    function mergeForecast(db, hotel, report) {
        db[hotel] ||= { segment: {} };
        const target = db[hotel];
        
        for (const [name, incomingSeg] of Object.entries(report.segmentData)) {
            const seg = target.segment[name] ||= { name, days: {} };
            for (const [iso, dt] of Object.entries(incomingSeg.days)) {
                seg.days[iso] = dt;
            }
        }
        target.updatedAt = new Date().toISOString();
        target.source = report.source;
        return [report.startYear];
    }

    const segments = data => Object.values(data?.segment || {}).filter(s => !/^(TOTAL|TOTAL_MASTER|TOTAL MASTER)$/.test(norm(s.name)));
    const availableMonths = data => Array.from({ length: 12 }, (_, i) => i).filter(i => data?.segmentCoverage?.[i] || segments(data).some(s => Number(s.revenue?.[i]) !== 0 && s.revenue?.[i] != null || Number(s.rooms?.[i]) !== 0 && s.rooms?.[i] != null));
    const sum = (s, field, selected) => selected.reduce((n, m) => n + (Number(s?.[field]?.[m]) || 0), 0);
    function aggregate(data, selected) {
        const detailed = selected.length > 0 && selected.every(m => data?.segmentCoverage?.[m]);
        const result = { revenue: 0, rooms: 0, accommodation: 0, days: detailed ? selected.reduce((n, m) => n + data.segmentCoverage[m].length, 0) : null };
        for (const s of segments(data)) { result.revenue += sum(s, 'revenue', selected); result.rooms += sum(s, 'rooms', selected); result.accommodation += sum(s, 'accommodation', selected); }
        result.adr = result.rooms > 0 ? result.accommodation / result.rooms : null;
        return result;
    }
    function comparable(a, b, selected) {
        return selected.length > 0 && selected.every(m => a?.segmentCoverage?.[m] && b?.segmentCoverage?.[m] && JSON.stringify(a.segmentCoverage[m]) === JSON.stringify(b.segmentCoverage[m]));
    }
    function scope(data, name) {
        if (!data || !name) return data;
        return { ...data, segment: Object.fromEntries(Object.entries(data.segment || {}).filter(([, segment]) => segment.name === name)) };
    }
    const api = { parse, merge, parseForecast, mergeForecast, aggregate, comparable, availableMonths, segments, sum, number, reviewRows, validSegments, canonical, scope };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SegmentAnalysis = api;
})(typeof window === 'undefined' ? globalThis : window);
