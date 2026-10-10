/* Shared, side-effect-free import and calculations for segment reports. */
(function (root) {
    'use strict';
    const norm = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[.]/g, '').trim();
    const months = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    const aliases = { 
        'CORPORATI': 'CORPORATIVO LINEAL', 
        'CO LINEAL': 'CORPORATIVO LINEAL',
        'COLINEAL': 'CORPORATIVO LINEAL',
        'TARIFAS NEGOCIADAS': 'CORPORATIVO LINEAL', 
        'TARIFAS N': 'CORPORATIVO LINEAL', 
        'TARIFAS NEG': 'CORPORATIVO LINEAL', 
        'TARIFAS NEGOCI': 'CORPORATIVO LINEAL', 
        'EMPRESAS': 'CORPORATIVO LINEAL', 
        'EMPRESA': 'CORPORATIVO LINEAL', 
        // Corporativo Dinámico y sus canales
        'CORPORATIVO DINAMICO': 'CORPORATIVO DINAMICO',
        'CORPORATIVO DIN': 'CORPORATIVO DINAMICO',
        'CO DINAMI': 'CORPORATIVO DINAMICO',
        'CODINAMI': 'CORPORATIVO DINAMICO',
        'CO DINAMICO': 'CORPORATIVO DINAMICO',
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
        'TELEFONO': 'DIRECTO OFFLINE',
        'EMAIL': 'DIRECTO OFFLINE',
        'CORREO ELECTRONICO': 'DIRECTO OFFLINE',
        'RECEPCION': 'DIRECTO OFFLINE',
        // Directo Online (motores propios: Guadiana -> Roiback, SynXis, Witbooking; Cumbria -> Web Hotel Synergy)
        'D ON LINE': 'DIRECTO ONLINE', 
        'DIRONLINE': 'DIRECTO ONLINE',
        'DIR ONLINE': 'DIRECTO ONLINE',
        'DIRECTO ON': 'DIRECTO ONLINE',
        'SERCOTEL': 'DIRECTO ONLINE', 
        'ROIBACK': 'DIRECTO ONLINE',
        'SYNXIS': 'DIRECTO ONLINE',
        'WITBOOKING': 'DIRECTO ONLINE',
        'WEB HOTEL SYNERGY': 'DIRECTO ONLINE',
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
        // Otros y Bonos
        'BONO LINE': 'BONO ONLINE', 
        'BONO SPA': 'BONO ONLINE',
        'BONO LINEAL': 'OTROS', 
        'SMARTBOX': 'OTROS',
        'EXMARBOOX': 'OTROS',
        'EGO EXPERIENCIAS': 'OTROS',
        'EGOEXPERIENCIAS': 'OTROS',
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

    const SEGMENT_NAMES_AND_ALIASES = new Set([
        // Segmentos maestros / canónicos
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
        'BONO SPA',

        // Variaciones y códigos PMS habituales para segmentos
        'BONO LINEAL',
        'BONO LINE',
        'CORPORATI',
        'CO LINEAL',
        'COLINEAL',
        'CORPORATIVO DIN',
        'CO DINAMI',
        'CODINAMI',
        'CO DINAMICO',
        'CORP DINAMICO',
        'CORP DINA',
        'CODINA',
        'DIRECTO O',
        'D OFF LINE',
        'DIRECTO OFF',
        'DIR OFF',
        'DIR OFFLINE',
        'DIROFFLINE',
        'D ON LINE',
        'DIRONLINE',
        'DIR ONLINE',
        'DIRECTO ON',
        'DIR ON',
        'OTA',
        'OTA / AAVV',
        'OTAS',
        'AAVV',
        'OTA-AAVV',
        'TTOO DINA',
        'TTOO',
        'TTOODINAMICA',
        'TTOO DIN',
        'GRUPO CONFIRMADO',
        'GRUPO TAN',
        'TANTEO',
        'PARTICULA',
        'PARTICULAR',
        'TOTAL',
        'TOTAL GENERAL',
        'TOTAL MASTER',
        'RESUMEN'
    ]);

    function isSegment(name) {
        if (!name) return false;
        const upper = norm(name);
        if (SEGMENT_NAMES_AND_ALIASES.has(upper)) return true;
        if (validSegments.includes(canonical(name))) {
            return !isKnownChannel(name);
        }
        return false;
    }

    const KNOWN_CHANNELS_MAP = {
        // OTAs
        'BOOKING': 'Booking.com',
        'BOOKING.COM': 'Booking.com',
        'BOOKINGCOM': 'Booking.com',
        'EXPEDIA': 'Expedia',
        'AGODA': 'Agoda',
        'AIRBNB': 'Airbnb',
        'HOTUSA': 'Hotusa',
        'RESTEL': 'Restel',
        'DESTINIA': 'Destinia',
        'EDREAMS': 'eDreams',
        'ODIGEO': 'eDreams',
        'LOGITRAVEL': 'Logitravel',
        'HOTELBEDS': 'Hotelbeds',
        'HBD': 'Hotelbeds',
        'SERHS': 'Serhs Tourism',
        'SERHS TOURISM': 'Serhs Tourism',
        'TRAVELTINO': 'Traveltino',
        'WEEKENDESK': 'Weekendesk',

        // Motores Directos / Web
        'ROIBACK': 'Roiback',
        'SERCOTEL': 'Sercotel',
        'DIRECTO WEB': 'Directo Online (Web)',
        'MOTOR': 'Directo Online (Web)',
        'MOTOR PROPIO': 'Directo Online (Web)',
        'WEB PROPIA': 'Directo Online (Web)',
        'DIRECTO ONLINE (WEB)': 'Directo Online (Web)',
        'SYNXIS': 'SynXis',
        'WITBOOKING': 'Witbooking',
        'WEB HOTEL SYNERGY': 'Web Hotel Synergy',
        'WEB HOTEL': 'Web Hotel Synergy',
        'SYNERGY': 'Web Hotel Synergy',

        // Directo Presencial / Mostrador
        'MOSTRADOR': 'Mostrador',
        'RECEPCION': 'Recepción',
        'TELEFONO': 'Teléfono',
        'EMAIL': 'Correo electrónico',
        'CORREO ELECTRONICO': 'Correo electrónico',

        // GDS / B2B Corporativo
        'KEYTEL': 'Keytel Phoenix',
        'KEYTEL PHOENIX': 'Keytel Phoenix',
        'KEYTEL - PHOENIX': 'Keytel Phoenix',
        'PHOENIX': 'Keytel Phoenix',
        'KEYTEL GDS': 'Keytel GDS',
        'SITEMINDER GDS': 'SiteMinder GDS',
        'SITEMINDER': 'SiteMinder GDS',
        'HRS': 'HRS',
        'VIAJES EL CORTE INGLES': 'Viajes El Corte Inglés',
        'EL CORTE INGLES': 'Viajes El Corte Inglés',
        'VECI': 'Viajes El Corte Inglés',
        'ECI': 'Viajes El Corte Inglés',
        'WORLD2MEET': 'World2Meet',
        'W2M': 'World2Meet',
        'GRUPO AVORIS': 'Grupo Ávoris',
        'AVORIS': 'Grupo Ávoris',
        'GRUPO AVO': 'Grupo Ávoris',
        'TARIFAS NEGOCIADAS': 'Tarifas Negociadas',
        'TARIFAS N': 'Tarifas Negociadas',
        'TARIFAS NEG': 'Tarifas Negociadas',
        'TARIFAS NEGOCI': 'Tarifas Negociadas',
        'EMPRESAS': 'Empresas Directas',
        'EMPRESA': 'Empresas Directas',

        // Bonos / Vouchers
        'SMARTBOX': 'Smartbox',
        'EXMARBOOX': 'Smartbox',
        'WONDERBOX': 'Wonderbox',
        'EGO EXPERIENCIAS': 'Ego Experiencias',
        'EGOEXPERIENCIAS': 'Ego Experiencias',
        'EGO': 'Ego Experiencias',
        'DAKOTABOX': 'Ego Experiencias',
        'BONO SPA': 'Bono Spa'
    };

    function isKnownChannel(name) {
        if (!name) return false;
        const upper = norm(name);
        return Boolean(KNOWN_CHANNELS_MAP[upper]);
    }

    function formatChannelName(raw) {
        if (!raw) return null;
        const s = String(raw).trim();
        const upper = norm(s);
        // Si coincide con un segmento o total, NO es un canal
        if (isSegment(s) || isTotalName(s)) return null;
        if (KNOWN_CHANNELS_MAP[upper]) return KNOWN_CHANNELS_MAP[upper];
        return null;
    }

    const DEFAULT_CHANNEL_COMMISSIONS = {
        'Booking.com': { pct: 0, fixedPerRN: 0 },
        'Expedia': { pct: 0, fixedPerRN: 0 },
        'Agoda': { pct: 0, fixedPerRN: 0 },
        'Airbnb': { pct: 0, fixedPerRN: 0 },
        'Destinia': { pct: 0, fixedPerRN: 0 },
        'eDreams': { pct: 0, fixedPerRN: 0 },
        'Logitravel': { pct: 0, fixedPerRN: 0 },
        'Hotusa': { pct: 0, fixedPerRN: 0 },
        'Restel': { pct: 0, fixedPerRN: 0 },
        'Roiback': { pct: 0, fixedPerRN: 0 },
        'Sercotel': { pct: 0, fixedPerRN: 0 },
        'Directo Online (Web)': { pct: 0, fixedPerRN: 0 },
        'SynXis': { pct: 0, fixedPerRN: 0 },
        'Witbooking': { pct: 0, fixedPerRN: 0 },
        'Web Hotel Synergy': { pct: 0, fixedPerRN: 0 },
        'Web Hotel': { pct: 0, fixedPerRN: 0 },
        'Synergy': { pct: 0, fixedPerRN: 0 },
        'Mostrador': { pct: 0, fixedPerRN: 0 },
        'Teléfono': { pct: 0, fixedPerRN: 0 },
        'Correo electrónico': { pct: 0, fixedPerRN: 0 },
        'Recepción': { pct: 0, fixedPerRN: 0 },
        'Tarifas Negociadas': { pct: 0, fixedPerRN: 0 },
        'Empresas Directas': { pct: 0, fixedPerRN: 0 },
        'Keytel Phoenix': { pct: 0, fixedPerRN: 0 },
        'Keytel GDS': { pct: 0, fixedPerRN: 0 },
        'SiteMinder GDS': { pct: 0, fixedPerRN: 0 },
        'HRS': { pct: 0, fixedPerRN: 0 },
        'Viajes El Corte Inglés': { pct: 0, fixedPerRN: 0 },
        'World2Meet': { pct: 0, fixedPerRN: 0 },
        'Hotelbeds': { pct: 0, fixedPerRN: 0 },
        'Serhs Tourism': { pct: 0, fixedPerRN: 0 },
        'Traveltino': { pct: 0, fixedPerRN: 0 },
        'Weekendesk': { pct: 0, fixedPerRN: 0 },
        'Grupo Ávoris': { pct: 0, fixedPerRN: 0 },
        'Smartbox': { pct: 0, fixedPerRN: 0 },
        'Wonderbox': { pct: 0, fixedPerRN: 0 },
        'Ego Experiencias': { pct: 0, fixedPerRN: 0 },
        'Bono Spa': { pct: 0, fixedPerRN: 0 }
    };

    const DEFAULT_SEGMENT_COMMISSIONS = {
        'OTA/AAVV': { pct: 0, fixedPerRN: 0 },
        'DIRECTO ONLINE': { pct: 0, fixedPerRN: 0 },
        'DIRECTO OFFLINE': { pct: 0, fixedPerRN: 0 },
        'CORPORATIVO LINEAL': { pct: 0, fixedPerRN: 0 },
        'CORPORATIVO DINAMICO': { pct: 0, fixedPerRN: 0 },
        'TTOO DINAMICA': { pct: 0, fixedPerRN: 0 },
        'GRUPOS': { pct: 0, fixedPerRN: 0 },
        'GRTANTEO': { pct: 0, fixedPerRN: 0 },
        'OTROS': { pct: 0, fixedPerRN: 0 },
        'PARTICULARES': { pct: 0, fixedPerRN: 0 },
        'AGENCIAS': { pct: 0, fixedPerRN: 0 },
        'BONO ONLINE': { pct: 0, fixedPerRN: 0 },
        'BONO SPA': { pct: 0, fixedPerRN: 0 }
    };

    const inMemoryCommissionConfig = {};

    function getChannelCommissionConfig(hotel = '') {
        try {
            const h = (hotel && typeof hotel === 'string') ? hotel : 'Guadiana';
            let raw = null;
            if (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) {
                raw = CapaStorage.getItem('channel_commissions_' + h);
            } else if (typeof window !== 'undefined' && window.localStorage) {
                raw = window.localStorage.getItem('channel_commissions_' + h);
            } else if (inMemoryCommissionConfig[h]) {
                raw = inMemoryCommissionConfig[h];
            }
            const saved = raw ? JSON.parse(raw) : {};
            // Filtrar cualquier segmento antiguo guardado por error en la configuración de canales
            const cleanSaved = {};
            for (const [k, v] of Object.entries(saved)) {
                if (!isSegment(k)) cleanSaved[k] = v;
            }
            return { ...DEFAULT_CHANNEL_COMMISSIONS, ...cleanSaved };
        } catch (e) {
            return { ...DEFAULT_CHANNEL_COMMISSIONS };
        }
    }

    function saveChannelCommissionConfig(hotel, config) {
        try {
            const h = (hotel && typeof hotel === 'string') ? hotel : 'Guadiana';
            const existing = getChannelCommissionConfig(h);
            const cleanConfig = {};
            for (const [k, v] of Object.entries(config || {})) {
                if (!isSegment(k)) cleanConfig[k] = v;
            }
            const merged = { ...existing, ...cleanConfig };
            const json = JSON.stringify(merged);
            if (typeof CapaStorage !== 'undefined' && CapaStorage.setItem) {
                CapaStorage.setItem('channel_commissions_' + h, json);
            }
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('channel_commissions_' + h, json);
            }
            inMemoryCommissionConfig[h] = json;
            return merged;
        } catch (e) {
            console.error('Error guardando comisiones de canales:', e);
            return config;
        }
    }

    function calculateNetMetrics(grossAccommodation, rooms, channelOrSegmentName, hotel = '') {
        const config = getChannelCommissionConfig(hotel);
        const nameNorm = norm(channelOrSegmentName);
        const canon = canonical(channelOrSegmentName);
        
        let rule = null;
        // 1. Si NO es un segmento, buscar en la configuración de canales
        if (!isSegment(channelOrSegmentName)) {
            rule = config[channelOrSegmentName] || config[canon];
            if (!rule) {
                for (const [k, v] of Object.entries(config)) {
                    if (norm(k) === nameNorm || norm(k) === norm(canon)) {
                        rule = v;
                        break;
                    }
                }
            }
        }

        // 2. Si es un segmento o no se encontró regla de canal, consultar comisiones por defecto de segmento
        if (!rule) {
            const segKey = canon || canonical(channelOrSegmentName);
            rule = DEFAULT_SEGMENT_COMMISSIONS[segKey] || DEFAULT_SEGMENT_COMMISSIONS[channelOrSegmentName];
            if (!rule) {
                for (const [k, v] of Object.entries(DEFAULT_SEGMENT_COMMISSIONS)) {
                    if (norm(k) === nameNorm || norm(k) === norm(canon)) {
                        rule = v;
                        break;
                    }
                }
            }
        }

        rule = rule || { pct: 0, fixedPerRN: 0 };
        const pctCommission = Number(rule.pct) || 0;
        const fixedFee = Number(rule.fixedPerRN) || 0;

        const commissionAmount = (grossAccommodation * (pctCommission / 100)) + (rooms * fixedFee);
        const netAccommodation = Math.max(0, grossAccommodation - commissionAmount);
        const grossAdr = rooms > 0 ? grossAccommodation / rooms : null;
        const netAdr = rooms > 0 ? netAccommodation / rooms : null;
        const netMarginPct = grossAccommodation > 0 ? (netAccommodation / grossAccommodation) * 100 : (100 - pctCommission);

        return {
            commissionPct: pctCommission,
            fixedFeePerRN: fixedFee,
            commissionAmount,
            netAccommodation,
            grossAdr,
            netAdr,
            netMarginPct
        };
    }

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
        let segment = null, totalBlock = false, roomRows = 0, lodgingRows = 0, currentChannel = null;
        for (let r = header + 1; r < rows.length; r++) {
            const row = rows[r] || [], rawName = String(row[0] ?? '').trim(), metric = norm(row[1]);
            const isRooms = isRoomMetric(metric);
            if (isRooms) {
                const block = blocks.find(b => b.row === r + 1);
                totalBlock = isTotalName(block.name);
                segment = totalBlock ? null : block.name;
                currentChannel = totalBlock ? null : formatChannelName(block.original);
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
                
                let chTarget = null;
                if (!totalBlock && currentChannel) {
                    target.channels ||= {};
                    chTarget = (target.channels[currentChannel] ||= {
                        name: currentChannel,
                        revenue: Array(12).fill(0),
                        rooms: Array(12).fill(0),
                        accommodation: Array(12).fill(0),
                        totalRevenue: Array(12).fill(0)
                    });
                }

                if (isRooms) {
                    target.rooms[c.month] += value;
                    if (chTarget) chTarget.rooms[c.month] += value;
                } else if (isTotal) {
                    target.totalRevenue[c.month] += value;
                    if (chTarget) chTarget.totalRevenue[c.month] += value;
                } else {
                    const safeMetric = metric || 'DESCONOCIDO';
                    // Si la métrica/concepto coincide con el nombre de un segmento, es un desglose del bloque de totales.
                    // Lo ignoramos para no sumarlo como concepto ni duplicar la producción.
                    if (validSegments.includes(canonical(safeMetric))) return;

                    target.concepts ||= {};
                    target.concepts[safeMetric] ||= Array(12).fill(0);
                    target.concepts[safeMetric][c.month] += value;
                    
                    target.revenue[c.month] += value;
                    if (chTarget) chTarget.revenue[c.month] += value;
                    if (isLodging) {
                        target.accommodation[c.month] += value;
                        target.accommodationVerified[c.month] = true;
                        if (chTarget) chTarget.accommodation[c.month] += value;
                    }
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
            for (const s of Object.values(y.segment)) {
                processFallback(s);
                if (s.channels) {
                    for (const ch of Object.values(s.channels)) {
                        if (!ch.revenue.some(v => v !== 0) && ch.totalRevenue.some(v => v !== 0)) {
                            ch.revenue = ch.totalRevenue.slice();
                            ch.accommodation = ch.totalRevenue.slice();
                        }
                    }
                }
            }
            
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
                    if (seg.channels) {
                        for (const ch of Object.values(seg.channels)) {
                            for (const field of fields) if (ch[field]) ch[field][m] = 0;
                        }
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
                    if (seg.channels) {
                        target.segment[name].channels ||= {};
                        // Limpiar canales antiguos que coincidan con nombres de segmentos
                        for (const k of Object.keys(target.segment[name].channels)) {
                            if (isSegment(k)) delete target.segment[name].channels[k];
                        }
                        for (const [chName, chData] of Object.entries(seg.channels)) {
                            if (isSegment(chName)) continue;
                            const tgtCh = target.segment[name].channels[chName] ||= {
                                name: chName,
                                revenue: Array(12).fill(0),
                                rooms: Array(12).fill(0),
                                accommodation: Array(12).fill(0),
                                totalRevenue: Array(12).fill(0)
                            };
                            for (const field of fields) {
                                tgtCh[field] ||= Array(12).fill(0);
                                tgtCh[field][m] = chData[field]?.[m] || 0;
                            }
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
            const currentChannel = formatChannelName(block.original);
            
            const target = segmentData[segment] ||= { name: segment, days: {}, channels: {} };
            let chTarget = null;
            if (currentChannel) {
                target.channels ||= {};
                chTarget = (target.channels[currentChannel] ||= { name: currentChannel, days: {} });
            }
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
                    const chDt = chTarget ? (chTarget.days[c.iso] ||= { revenue: 0, rooms: 0, accommodation: 0, totalRevenue: 0 }) : null;
                    
                    if (isRooms) {
                        dt.rooms += value;
                        if (chDt) chDt.rooms += value;
                    } else if (isTotal) {
                        dt.totalRevenue += value;
                        if (chDt) chDt.totalRevenue += value;
                    } else {
                        if (validSegments.includes(canonical(metric))) return;
                        dt.revenue += value;
                        if (chDt) chDt.revenue += value;
                        if (isLodging) {
                            dt.accommodation += value;
                            if (chDt) chDt.accommodation += value;
                        }
                        dt.concepts ||= {};
                        dt.concepts[metric] = (dt.concepts[metric] || 0) + value;
                    }
                });
            }
            
            for (const dt of Object.values(target.days)) {
                dt.accommodationVerified = lodgingRows > 0;
                if (!Object.keys(dt.concepts || {}).length) dt.revenue = dt.totalRevenue;
            }
            if (chTarget) {
                for (const chDt of Object.values(chTarget.days)) {
                    chDt.accommodationVerified = lodgingRows > 0;
                    if (chDt.revenue === 0 && chDt.totalRevenue > 0) chDt.revenue = chDt.totalRevenue;
                }
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
            if (incomingSeg.channels) {
                seg.channels ||= {};
                for (const [chName, incomingCh] of Object.entries(incomingSeg.channels)) {
                    const ch = seg.channels[chName] ||= { name: chName, days: {} };
                    for (const [iso, chDt] of Object.entries(incomingCh.days)) {
                        ch.days[iso] = chDt;
                    }
                }
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
    function getSegmentChannels(segment, selectedMonths, hotel = '') {
        if (!segment) return [];
        const mList = Array.isArray(selectedMonths) && selectedMonths.length ? selectedMonths : Array.from({ length: 12 }, (_, i) => i);
        if (segment.channels && Object.keys(segment.channels).length > 0) {
            return Object.values(segment.channels)
                .filter(ch => ch && ch.name && !isSegment(ch.name))
                .map(ch => {
                    const rooms = sum(ch, 'rooms', mList);
                    const accommodation = sum(ch, 'accommodation', mList);
                    const revenue = sum(ch, 'revenue', mList);
                    const totalRevenue = sum(ch, 'totalRevenue', mList);
                    const adr = rooms > 0 && accommodation > 0 ? accommodation / rooms : (rooms > 0 && revenue > 0 ? revenue / rooms : null);
                    const net = calculateNetMetrics(accommodation, rooms, ch.name, hotel);
                    return {
                        name: ch.name,
                        rooms,
                        accommodation,
                        revenue,
                        totalRevenue,
                        adr,
                        commissionPct: net.commissionPct,
                        fixedFeePerRN: net.fixedFeePerRN,
                        commissionAmount: net.commissionAmount,
                        netAccommodation: net.netAccommodation,
                        netAdr: net.netAdr,
                        netMarginPct: net.netMarginPct
                    };
                }).filter(ch => ch.rooms > 0 || ch.accommodation > 0 || ch.revenue > 0 || ch.totalRevenue > 0);
        }
        return [];
    }

    function aggregateNet(data, selectedMonths, hotel = '') {
        const mList = Array.isArray(selectedMonths) && selectedMonths.length ? selectedMonths : Array.from({ length: 12 }, (_, i) => i);
        let grossAccommodation = 0;
        let rooms = 0;
        let totalCommissions = 0;
        let netAccommodation = 0;

        for (const seg of segments(data)) {
            const chList = getSegmentChannels(seg, mList, hotel);
            if (chList && chList.length > 0) {
                for (const ch of chList) {
                    grossAccommodation += ch.accommodation;
                    rooms += ch.rooms;
                    totalCommissions += ch.commissionAmount;
                    netAccommodation += ch.netAccommodation;
                }
            } else {
                const sRooms = sum(seg, 'rooms', mList);
                const sAcc = sum(seg, 'accommodation', mList);
                const net = calculateNetMetrics(sAcc, sRooms, seg.name, hotel);
                grossAccommodation += sAcc;
                rooms += sRooms;
                totalCommissions += net.commissionAmount;
                netAccommodation += net.netAccommodation;
            }
        }

        const grossAdr = rooms > 0 ? grossAccommodation / rooms : null;
        const netAdr = rooms > 0 ? netAccommodation / rooms : null;
        const netMarginPct = grossAccommodation > 0 ? (netAccommodation / grossAccommodation) * 100 : null;

        return {
            grossAccommodation,
            rooms,
            totalCommissions,
            netAccommodation,
            grossAdr,
            netAdr,
            netMarginPct
        };
    }

    const api = { 
        parse, 
        merge, 
        parseForecast, 
        mergeForecast, 
        aggregate, 
        aggregateNet,
        comparable, 
        availableMonths, 
        segments, 
        sum, 
        number, 
        reviewRows, 
        validSegments, 
        canonical, 
        scope, 
        getHotelMappings: getStoredHotelMappings, 
        saveHotelMappings: saveStoredHotelMappings, 
        formatChannelName, 
        isSegment,
        isKnownChannel,
        getSegmentChannels,
        getChannelCommissionConfig,
        saveChannelCommissionConfig,
        calculateNetMetrics,
        DEFAULT_CHANNEL_COMMISSIONS,
        DEFAULT_SEGMENT_COMMISSIONS
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.SegmentAnalysis = api;
})(typeof window === 'undefined' ? globalThis : window);
