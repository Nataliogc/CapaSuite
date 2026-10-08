/* Shared, side-effect-free import and calculations for segment reports. */
(function (root) {
    'use strict';
    const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.]/g, '').trim();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const aliases = { 
        'CORPORATI': 'CORPORATIVO LINEAL', 
        'TARIFAS NEGOCIADAS': 'CORPORATIVO LINEAL', 
        'TARIFAS N': 'CORPORATIVO LINEAL', 
        'TARIFAS NEG': 'CORPORATIVO LINEAL', 
        'TARIFAS NEGOCI': 'CORPORATIVO LINEAL', 
        'EMPRESAS': 'CORPORATIVO LINEAL', 
        'EMPRESA': 'CORPORATIVO LINEAL', 
        // Corporativo Dinámico y sus canales
        'CORPORATIVO DINAMICO': 'CORPORATIVO DINAMICO',
        'CORPORATIVO DIN': 'CORPORATIVO DINAMICO',
        'CORP DINAMICO': 'CORPORATIVO DINAMICO',
        'CORP DINA': 'CORPORATIVO DINAMICO',
        'HRS': 'CORPORATIVO DINAMICO',
        'KEYTEL PHOENIX': 'CORPORATIVO DINAMICO',
        'KEYTEL - PHOENIX': 'CORPORATIVO DINAMICO',
        'KEYTEL': 'CORPORATIVO DINAMICO',
        'PHOENIX': 'CORPORATIVO DINAMICO',
        'KEYTEL GDS': 'CORPORATIVO DINAMICO',
        'SITEMINDER GDS': 'CORPORATIVO DINAMICO',
        'SITEMINDER': 'CORPORATIVO DINAMICO',
        'VIAJES EL CORTE INGLES': 'CORPORATIVO DINAMICO',
        'EL CORTE INGLES': 'CORPORATIVO DINAMICO',
        'VECI': 'CORPORATIVO DINAMICO',
        'WORLD2MEET': 'CORPORATIVO DINAMICO',
        'W2M': 'CORPORATIVO DINAMICO',
        // Directo Offline
        'DIRECTO O': 'DIRECTO OFFLINE', 
        'D OFF LINE': 'DIRECTO OFFLINE', 
        'DIRECTO OFF': 'DIRECTO OFFLINE',
        'MOSTRADOR': 'DIRECTO OFFLINE',
        // Directo Online (motores propios)
        'D ON LINE': 'DIRECTO ONLINE', 
        'DIRONLINE': 'DIRECTO ONLINE',
        'DIR ONLINE': 'DIRECTO ONLINE',
        'DIRECTO ON': 'DIRECTO ONLINE',
        'SERCOTEL': 'DIRECTO ONLINE', 
        'ROIBACK': 'DIRECTO ONLINE',
        'SYNXIS': 'DIRECTO ONLINE',
        'WITBOOKING': 'DIRECTO ONLINE',
        'WEB HOTEL': 'DIRECTO ONLINE',
        'SYNERGY': 'DIRECTO ONLINE',
        // OTA / AAVV
        'OTA': 'OTA/AAVV', 
        'OTA / AAVV': 'OTA/AAVV',
        'OTAS': 'OTA/AAVV',
        'AAVV': 'OTA/AAVV',
        'BOOKING': 'OTA/AAVV',
        'BOOKINGCOM': 'OTA/AAVV',
        'EXPEDIA': 'OTA/AAVV',
        'GRUPO AVORIS': 'AGENCIAS',
        'GRUPO AVO': 'OTA/AAVV',
        // TTOO Dinámica
        'TTOO DINA': 'TTOO DINAMICA', 
        'TTOO': 'TTOO DINAMICA',
        'HOTELBEDS': 'TTOO DINAMICA',
        'SERHS TOURISM': 'TTOO DINAMICA',
        'SERHS': 'TTOO DINAMICA',
        'TRAVELTINO': 'TTOO DINAMICA',
        'WEEKENDESK': 'TTOO DINAMICA',
        // Otros
        'BONO LINE': 'BONO ONLINE', 
        'BONO LINEAL': 'OTROS', 
        'SMARTBOX': 'OTROS',
        'EGO EXPERIENCIAS': 'OTROS',
        'EGO': 'OTROS',
        'WONDERBOX': 'OTROS',
        // Grupos
        'GRUPO': 'GRUPOS',
        'GRUPO CONFIRMADO': 'GRUPOS',
        'GRUPO TANTEO': 'GRTANTEO', 
        'GRUPO TAN': 'GRTANTEO',
        // Otros históricos
        'PARTICULA': 'PARTICULARES'
    };
    const validSegments = [
        'CORPORATIVO LINEAL',
        'CORPORATIVO DINAMICO',
        'DIRECTO OFFLINE',
        'DIRECTO ONLINE',
        'GRTANTEO',
        'GRUPO TANTEO',
        'GRUPOS',
        'GRUPO',
        'OTA/AAVV',
        'OTROS',
        'TTOO DINAMICA',
        'PARTICULARES',
        'AGENCIAS',
        'BONO ONLINE',
        'BONO SPA'
    ];
    const isRoomMetric = value => /^(HAB|HABI|RN|RMS|NOCHES|HABITACIONES|UNIDADES)$/.test(norm(value));
    const canonical = value => aliases[norm(value)] || norm(value);
    const isTotalName = value => /^(TOTAL|TOTAL GENERAL|TOTAL MASTER|RESUMEN)$/.test(norm(value));

    function getStoredHotelMappings(hotel) {
        try {
            const h = (hotel && typeof hotel === 'string') ? hotel : 'Guadiana';
            let raw = null;
            if (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) {
                raw = CapaStorage.getItem('segment_mappings_' + h);
            }
            if (!raw && typeof window !== 'undefined' && window.localStorage) {
                raw = window.localStorage.getItem('segment_mappings_' + h);
            }
            return raw ? JSON.parse(raw) : {};
        } catch (e) {
            return {};
        }
    }

    function saveStoredHotelMappings(hotel, mappings) {
        try {
            const h = (hotel && typeof hotel === 'string') ? hotel : 'Guadiana';
            const existing = getStoredHotelMappings(h);
            const merged = { ...existing, ...mappings };
            const json = JSON.stringify(merged);

            if (typeof CapaStorage !== 'undefined' && CapaStorage.setItem) {
                CapaStorage.setItem('segment_mappings_' + h, json);
            }
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('segment_mappings_' + h, json);
            }
            return merged;
        } catch (e) {
            console.error('Error guardando mapeos de hotel:', e);
            return mappings;
        }
    }

    function reviewRows(rows, corrections = {}, hotel = '') {
        const hotelMappings = (typeof hotel === 'object' && hotel !== null) ? hotel : getStoredHotelMappings(hotel);
        const habRows = [];
        rows.forEach((row, index) => {
            if (isRoomMetric(row?.[1])) {
                habRows.push({ row: index + 1, index, original: String(row[0] ?? '').trim() });
            }
        });
        return habRows.map((item, idx) => {
            if (idx === habRows.length - 1 && !item.original && habRows.length > 1) {
                const thisRow = rows[item.index] || [];
                for (let c = 2; c < thisRow.length; c++) {
                    const val = Number(String(thisRow[c] || '').replace(/[€\s\u00a0,]/g, ''));
                    if (val > 0) {
                        const prevSum = habRows.slice(0, -1).reduce((s, h) => s + (Number(String(rows[h.index]?.[c] || '').replace(/[€\s\u00a0,]/g, '')) || 0), 0);
                        if (prevSum === val) {
                            item.original = 'TOTAL GENERAL';
                            break;
                        }
                    }
                }
            }
            const cell = 'A' + item.row;
            const rawNorm = norm(item.original);
            let value = '';
            if (Object.hasOwn(corrections, cell)) {
                value = corrections[cell];
            } else if (hotelMappings && hotelMappings[rawNorm]) {
                value = hotelMappings[rawNorm];
            } else if (hotelMappings && hotelMappings[cell]) {
                value = hotelMappings[cell];
            } else if (aliases[rawNorm]) {
                value = aliases[rawNorm];
            } else {
                value = item.original;
            }

            // An explicit choice in this import takes precedence over remembered mappings.
            let name = Object.hasOwn(corrections, cell) ? canonical(value)
                : (hotelMappings && hotelMappings[rawNorm]) ? hotelMappings[rawNorm] : canonical(value);
            const reason = !name ? 'Falta el segmento a la izquierda de Hab.' : !validSegments.includes(name) && !isTotalName(name) ? 'Segmento no válido. Debes asignarlo a un segmento correcto.' : '';
            return { cell, row: item.row, original: item.original, name, reason };
        });
    }
    const fields = ['revenue', 'rooms', 'accommodation', 'totalRevenue'];
    const empty = name => ({ name, concepts: {}, accommodationVerified: Array(12).fill(false), ...Object.fromEntries(fields.map(k => [k, Array(12).fill(0)])) });
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
    function parse(rows, fileName = '', hintYear, corrections = {}, hotel = '') {
        const detectedHotel = hotel || (fileName.toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana');
        const dateYears = [...fileName.matchAll(/\d{1,2}[-/]\d{1,2}[-/](\d{4}|\d{2})(?!\d)/g)].map(m => m[1].length === 2 ? (Number(m[1]) > 50 ? '19' : '20') + m[1] : m[1]);
        if (!dateYears.length) {
            const year4 = [...fileName.matchAll(/\b(20\d{2})\b/g)].map(m => m[1]);
            if (year4.length) {
                dateYears.push(...year4);
            } else {
                const year2 = [...fileName.matchAll(/(?:[-_ ]|^)(2[0-9])(?:[^0-9]|$)/g)].map(m => '20' + m[1]);
                if (year2.length) dateYears.push(...year2);
            }
        }
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
        const blocks = reviewRows(rows, corrections, detectedHotel), issues = blocks.filter(block => block.reason);
        if (issues.length) {
            const error = new Error('Revisa los segmentos: ' + issues.map(b => `${b.cell}: ${b.reason}`).join(' '));
            error.code = 'SEGMENT_REVIEW'; error.issues = issues; error.blocks = blocks; error.hotel = detectedHotel;
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
                    const safeMetric = metric || 'DESCONOCIDO';
                    // Si la métrica/concepto coincide con el nombre de un segmento, es un desglose del bloque de totales.
                    // Lo ignoramos para no sumarlo como concepto ni duplicar la producción.
                    if (validSegments.includes(canonical(safeMetric))) return;

                    target.concepts ||= {};
                    target.concepts[safeMetric] ||= Array(12).fill(0);
                    target.concepts[safeMetric][c.month] += value;
                    
                    target.revenue[c.month] += value;
                    if (isLodging) { target.accommodation[c.month] += value; target.accommodationVerified[c.month] = true; }
                }
                if (totalBlock) y.controls.present = true;
            });
        }
        if (!roomRows) throw new Error('El informe no contiene segmentos con una fila de habitaciones.');
        
        for (const y of Object.values(years)) {
            const processFallback = (target) => {
                if (!target) return;
                // A summary is a fallback only when the source has no monetary breakdown.
                if (!Object.keys(target.concepts || {}).length) {
                    target.revenue = target.totalRevenue.slice();
                }
            };
            if (y.controls.present) processFallback(y.controls.values);
            for (const s of Object.values(y.segment)) processFallback(s);
            
            for (const [m, days] of Object.entries(y.coverage)) {
                days.sort((a, b) => a - b);
                if (y.controls.present) for (const field of ['rooms', 'revenue', 'accommodation']) {
                    const actual = Object.values(y.segment).reduce((s, seg) => s + seg[field][m], 0);
                    const maxDiff = field === 'rooms' ? 0 : Math.max(10, actual * 0.0005);
                    if (Math.abs(actual - y.controls.values[field][m]) > maxDiff) throw new Error(`El total de ${field} no cuadra con los segmentos. Revisa el bloque de totales del archivo.`);
                }
            }
        }
        return { years, source: fileName, corrections: blocks.filter(b => b.original !== b.name).map(b => ({ cell: b.cell, original: b.original, segment: b.name })) };
    }
    function merge(db, hotel, report) {
        db[hotel] ||= {};
        for (const [year, incoming] of Object.entries(report.years)) {
            const target = db[hotel][year] ||= { service: {}, segment: {} };
            if (target.segment && Object.keys(target.segment).length > 0) {
                target.segment_prev = JSON.parse(JSON.stringify(target.segment));
            }
            target.segment ||= {};
            target.segmentCoverage ||= {};
            target.segmentSources ||= {};
            target.segmentCorrections ||= {};
            for (const m of Object.keys(incoming.coverage)) {
                for (const seg of Object.values(target.segment)) {
                    for (const field of fields) if (seg[field]) seg[field][m] = 0;
                    if (seg.accommodationVerified) seg.accommodationVerified[m] = false;
                    if (seg.concepts) {
                        for (const concept of Object.values(seg.concepts)) concept[m] = 0;
                    }
                }
                for (const [name, seg] of Object.entries(incoming.segment)) {
                    // Define own keys, including unusual names supplied by external reports.
                    if (!Object.hasOwn(target.segment, name)) Object.defineProperty(target.segment, name, { value: empty(name), writable: true, enumerable: true, configurable: true });
                    for (const field of fields) { target.segment[name][field] ||= Array(12).fill(0); target.segment[name][field][m] = seg[field][m]; }
                    
                    target.segment[name].accommodationVerified ||= Array(12).fill(false);
                    target.segment[name].accommodationVerified[m] = seg.accommodationVerified[m];
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
    function parseForecast(rows, fileName = '', corrections = {}, hintPeriod, hotel = '') {
        const detectedHotel = hotel || (fileName.toLowerCase().includes('cumbria') ? 'Cumbria' : 'Guadiana');
        let startYear = Number((String(hintPeriod || fileName).match(/20\d{2}/) || [new Date().getFullYear()])[0]);
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
            column(`${c.day}/${c.month + 1}/${currentYear}`);
            return { iso: `${currentYear}-${String(c.month + 1).padStart(2, '0')}-${String(c.day).padStart(2, '0')}` };
        });

        const dates = columns.filter(Boolean).map(c => c.iso);
        if (new Set(dates).size !== dates.length) throw new Error('Fecha duplicada en la cabecera.');
        const blocks = reviewRows(rows, corrections, detectedHotel);
        if (blocks.some(b => b.reason)) {
            const error = new Error('Revisión requerida');
            error.code = 'SEGMENT_REVIEW';
            error.issues = blocks.filter(b => b.reason);
            error.blocks = blocks;
            error.hotel = detectedHotel;
            throw error;
        }

        for (let i = 0; i < blocks.length; i++) {
            blocks[i].end = i + 1 < blocks.length ? blocks[i+1].row - 2 : rows.length - 1;
        }
        const segmentData = {};

        for (const block of blocks) {
            const segment = block.name;
            if (/^(TOTAL|TOTAL GENERAL|TOTAL MASTER|RESUMEN)$/.test(norm(segment)) || !segment) continue;
            
            const target = segmentData[segment] ||= { name: segment, days: {} };
            let roomRows = 0, lodgingRows = 0;

            for (let r = block.row - 1; r <= block.end; r++) {
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
                    
                    const dt = target.days[c.iso] ||= { revenue: 0, rooms: 0, accommodation: 0, totalRevenue: 0 };
                    
                    if (isRooms) dt.rooms += value;
                    else if (isTotal) dt.totalRevenue += value;
                    else {
                        if (validSegments.includes(canonical(metric))) return;
                        dt.revenue += value;
                        if (isLodging) dt.accommodation += value;
                        dt.concepts ||= {};
                        dt.concepts[metric] = (dt.concepts[metric] || 0) + value;
                    }
                });
            }
            
            for (const dt of Object.values(target.days)) {
                dt.accommodationVerified = lodgingRows > 0;
                if (!Object.keys(dt.concepts || {}).length) dt.revenue = dt.totalRevenue;
            }
        }
        return { segmentData, coverage: columns.filter(Boolean).map(c => c.iso), source: fileName, startYear };
    }

    function mergeForecast(db, hotel, report) {
        db[hotel] ||= { segment: {} };
        const target = db[hotel];
        const previousForecast = {
            segment: JSON.parse(JSON.stringify(target.segment || {})),
            updatedAt: target.updatedAt,
            source: target.source
        };
        if (target.segment && Object.keys(target.segment).length > 0) {
            target.segment_prev = JSON.parse(JSON.stringify(target.segment));
            target.prevUpdatedAt = target.updatedAt;
            target.prevSource = target.source;
        }
        const covered = new Set(report.coverage || Object.values(report.segmentData).flatMap(s => Object.keys(s.days)));
        for (const seg of Object.values(target.segment || {})) {
            for (const iso of covered) delete seg.days[iso];
        }
        for (const [name, incomingSeg] of Object.entries(report.segmentData)) {
            const seg = target.segment[name] ||= { name, days: {} };
            for (const [iso, dt] of Object.entries(incomingSeg.days)) {
                seg.days[iso] = dt;
            }
        }
        const uploadedAt = new Date();
        const uploadDay = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(uploadedAt);
        if (!target.pickupBaseline || target.pickupBaseline.day !== uploadDay) {
            const hasPrevious = Object.keys(previousForecast.segment).length > 0;
            target.pickupBaseline = { day: uploadDay,
                segment: hasPrevious ? previousForecast.segment : JSON.parse(JSON.stringify(target.segment)),
                updatedAt: hasPrevious ? previousForecast.updatedAt : uploadedAt.toISOString(),
                source: hasPrevious ? previousForecast.source : report.source };
        }
        if (target.segment_prev) target.segment_prev = JSON.parse(JSON.stringify(target.pickupBaseline.segment));
        target.prevUpdatedAt = target.pickupBaseline.updatedAt;
        target.prevSource = target.pickupBaseline.source;
        target.updatedAt = uploadedAt.toISOString();
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
        const activeSegments = segments(data).filter(s => sum(s, 'rooms', selected) > 0);
        const verified = activeSegments.length > 0 && activeSegments.every(s =>
            s.accommodation != null && selected.every(m =>
                (s.rooms?.[m] || 0) === 0 || (
                    s.accommodation[m] != null &&
                    (s.accommodationVerified
                        ? s.accommodationVerified[m] !== false || s.accommodation[m] > 0
                        : (s.concepts == null || Object.keys(s.concepts).length === 0 || Object.keys(s.concepts).some(k => /HABITACI|ALOJAMIENTO|ALOJAM|SUITE|CAMA SUPLETORIA|LATE CHECK OUT|AMPLIACION|RECARGO|REGARGO|\b(DIA|NOCHE|INDIVIDUAL|DOBLE)\b/.test(k))))
                )
            )
        );
        result.adr = verified && result.rooms > 0 && result.accommodation > 0 ? result.accommodation / result.rooms : null;
        return result;
    }
    function comparable(a, b, selected) {
        return selected.length > 0 && selected.every(m => a?.segmentCoverage?.[m] && b?.segmentCoverage?.[m] && JSON.stringify(a.segmentCoverage[m]) === JSON.stringify(b.segmentCoverage[m]));
    }
    function scope(data, name) {
        if (!data || !name) return data;
        return { ...data, segment: Object.fromEntries(Object.entries(data.segment || {}).filter(([, segment]) => segment.name === name)) };
    }
    const api = { parse, merge, parseForecast, mergeForecast, aggregate, comparable, availableMonths, segments, sum, number, reviewRows, validSegments, canonical, scope, getHotelMappings: getStoredHotelMappings, saveHotelMappings: saveStoredHotelMappings };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SegmentAnalysis = api;
})(typeof window === 'undefined' ? globalThis : window);
