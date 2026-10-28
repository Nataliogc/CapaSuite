/**
 * CapaSuite - Pricing Intelligence Engine
 * Módulo independiente de Inteligencia de Precios, Históricos de Pick-up y Yield Management.
 * Gestión multi-hotel, multi-año y multi-mes integrada 100% en la aplicación (sin dependencias de Excel).
 * Sercotel Guadiana / Hotel Cumbria
 */

(function (root) {
    'use strict';

    // 1. MATRICES DE TARIFAS BASE POR DEFECTO (AÑO, HOTEL, MES, DÍA)
    // DOW: 1=Lunes .. 7=Domingo (normalizado para visualización europea)
    const DEFAULT_BAR_MATRICES = {
        Guadiana: {
            2027: {
                1:  { name: "Enero",      1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 },
                2:  { name: "Febrero",    1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 },
                3:  { name: "Marzo",      1: 66, 2: 68, 3: 68, 4: 66, 5: 73, 6: 78, 7: 60 },
                4:  { name: "Abril",      1: 72, 2: 74, 3: 74, 4: 72, 5: 78, 6: 85, 7: 64 },
                5:  { name: "Mayo",       1: 68, 2: 70, 3: 70, 4: 68, 5: 75, 6: 85, 7: 62 },
                6:  { name: "Junio",      1: 68, 2: 70, 3: 70, 4: 68, 5: 75, 6: 85, 7: 62 },
                7:  { name: "Julio",      1: 66, 2: 68, 3: 68, 4: 66, 5: 75, 6: 78, 7: 60 },
                8:  { name: "Agosto",     1: 68, 2: 70, 3: 70, 4: 68, 5: 75, 6: 80, 7: 62 },
                9:  { name: "Septiembre", 1: 72, 2: 74, 3: 74, 4: 72, 5: 78, 6: 85, 7: 64 },
                10: { name: "Octubre",    1: 72, 2: 74, 3: 74, 4: 72, 5: 78, 6: 85, 7: 64 },
                11: { name: "Noviembre",  1: 66, 2: 68, 3: 68, 4: 66, 5: 73, 6: 78, 7: 60 },
                12: { name: "Diciembre",  1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 }
            },
            2026: {
                1:  { name: "Enero",      1: 60, 2: 62, 3: 62, 4: 60, 5: 68, 6: 72, 7: 55 },
                2:  { name: "Febrero",    1: 60, 2: 62, 3: 62, 4: 60, 5: 68, 6: 72, 7: 55 },
                3:  { name: "Marzo",      1: 64, 2: 66, 3: 66, 4: 64, 5: 70, 6: 75, 7: 58 },
                4:  { name: "Abril",      1: 70, 2: 72, 3: 72, 4: 70, 5: 75, 6: 82, 7: 62 },
                5:  { name: "Mayo",       1: 66, 2: 68, 3: 68, 4: 66, 5: 72, 6: 82, 7: 60 },
                6:  { name: "Junio",      1: 66, 2: 68, 3: 68, 4: 66, 5: 72, 6: 82, 7: 60 },
                7:  { name: "Julio",      1: 64, 2: 66, 3: 66, 4: 64, 5: 72, 6: 75, 7: 58 },
                8:  { name: "Agosto",     1: 66, 2: 68, 3: 68, 4: 66, 5: 72, 6: 78, 7: 60 },
                9:  { name: "Septiembre", 1: 70, 2: 72, 3: 72, 4: 70, 5: 75, 6: 82, 7: 62 },
                10: { name: "Octubre",    1: 70, 2: 72, 3: 72, 4: 70, 5: 75, 6: 82, 7: 62 },
                11: { name: "Noviembre",  1: 64, 2: 66, 3: 66, 4: 64, 5: 70, 6: 75, 7: 58 },
                12: { name: "Diciembre",  1: 60, 2: 62, 3: 62, 4: 60, 5: 68, 6: 72, 7: 55 }
            },
            2028: {
                1:  { name: "Enero",      1: 65, 2: 67, 3: 67, 4: 65, 5: 73, 6: 78, 7: 61 },
                2:  { name: "Febrero",    1: 65, 2: 67, 3: 67, 4: 65, 5: 73, 6: 78, 7: 61 },
                3:  { name: "Marzo",      1: 69, 2: 71, 3: 71, 4: 69, 5: 76, 6: 82, 7: 63 },
                4:  { name: "Abril",      1: 75, 2: 78, 3: 78, 4: 75, 5: 82, 6: 89, 7: 67 },
                5:  { name: "Mayo",       1: 71, 2: 74, 3: 74, 4: 71, 5: 79, 6: 89, 7: 65 },
                6:  { name: "Junio",      1: 71, 2: 74, 3: 74, 4: 71, 5: 79, 6: 89, 7: 65 },
                7:  { name: "Julio",      1: 69, 2: 71, 3: 71, 4: 69, 5: 79, 6: 82, 7: 63 },
                8:  { name: "Agosto",     1: 71, 2: 74, 3: 74, 4: 71, 5: 79, 6: 84, 7: 65 },
                9:  { name: "Septiembre", 1: 75, 2: 78, 3: 78, 4: 75, 5: 82, 6: 89, 7: 67 },
                10: { name: "Octubre",    1: 75, 2: 78, 3: 78, 4: 75, 5: 82, 6: 89, 7: 67 },
                11: { name: "Noviembre",  1: 69, 2: 71, 3: 71, 4: 69, 5: 76, 6: 82, 7: 63 },
                12: { name: "Diciembre",  1: 65, 2: 67, 3: 67, 4: 65, 5: 73, 6: 78, 7: 61 }
            }
        },
        Cumbria: {
            2027: {
                1:  { name: "Enero",      1: 59, 2: 61, 3: 61, 4: 59, 5: 67, 6: 72, 7: 55 },
                2:  { name: "Febrero",    1: 59, 2: 61, 3: 61, 4: 59, 5: 67, 6: 72, 7: 55 },
                3:  { name: "Marzo",      1: 63, 2: 65, 3: 65, 4: 63, 5: 70, 6: 75, 7: 57 },
                4:  { name: "Abril",      1: 69, 2: 71, 3: 71, 4: 69, 5: 75, 6: 82, 7: 61 },
                5:  { name: "Mayo",       1: 65, 2: 67, 3: 67, 4: 65, 5: 72, 6: 82, 7: 59 },
                6:  { name: "Junio",      1: 65, 2: 67, 3: 67, 4: 65, 5: 72, 6: 82, 7: 59 },
                7:  { name: "Julio",      1: 63, 2: 65, 3: 65, 4: 63, 5: 72, 6: 75, 7: 57 },
                8:  { name: "Agosto",     1: 65, 2: 67, 3: 67, 4: 65, 5: 72, 6: 77, 7: 59 },
                9:  { name: "Septiembre", 1: 69, 2: 71, 3: 71, 4: 69, 5: 75, 6: 82, 7: 61 },
                10: { name: "Octubre",    1: 69, 2: 71, 3: 71, 4: 69, 5: 75, 6: 82, 7: 61 },
                11: { name: "Noviembre",  1: 63, 2: 65, 3: 65, 4: 63, 5: 70, 6: 75, 7: 57 },
                12: { name: "Diciembre",  1: 59, 2: 61, 3: 61, 4: 59, 5: 67, 6: 72, 7: 55 }
            },
            2026: {
                1:  { name: "Enero",      1: 57, 2: 59, 3: 59, 4: 57, 5: 65, 6: 69, 7: 52 },
                2:  { name: "Febrero",    1: 57, 2: 59, 3: 59, 4: 57, 5: 65, 6: 69, 7: 52 },
                3:  { name: "Marzo",      1: 61, 2: 63, 3: 63, 4: 61, 5: 67, 6: 72, 7: 55 },
                4:  { name: "Abril",      1: 67, 2: 69, 3: 69, 4: 67, 5: 72, 6: 79, 7: 59 },
                5:  { name: "Mayo",       1: 63, 2: 65, 3: 65, 4: 63, 5: 69, 6: 79, 7: 57 },
                6:  { name: "Junio",      1: 63, 2: 65, 3: 65, 4: 63, 5: 69, 6: 79, 7: 57 },
                7:  { name: "Julio",      1: 61, 2: 63, 3: 63, 4: 61, 5: 69, 6: 72, 7: 55 },
                8:  { name: "Agosto",     1: 63, 2: 65, 3: 65, 4: 63, 5: 69, 6: 75, 7: 57 },
                9:  { name: "Septiembre", 1: 67, 2: 69, 3: 69, 4: 67, 5: 72, 6: 79, 7: 59 },
                10: { name: "Octubre",    1: 67, 2: 69, 3: 69, 4: 67, 5: 72, 6: 79, 7: 59 },
                11: { name: "Noviembre",  1: 61, 2: 63, 3: 63, 4: 61, 5: 67, 6: 72, 7: 55 },
                12: { name: "Diciembre",  1: 57, 2: 59, 3: 59, 4: 57, 5: 65, 6: 69, 7: 52 }
            },
            2028: {
                1:  { name: "Enero",      1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 },
                2:  { name: "Febrero",    1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 },
                3:  { name: "Marzo",      1: 66, 2: 68, 3: 68, 4: 66, 5: 73, 6: 79, 7: 60 },
                4:  { name: "Abril",      1: 72, 2: 75, 3: 75, 4: 72, 5: 79, 6: 86, 7: 64 },
                5:  { name: "Mayo",       1: 68, 2: 71, 3: 71, 4: 68, 5: 76, 6: 86, 7: 62 },
                6:  { name: "Junio",      1: 68, 2: 71, 3: 71, 4: 68, 5: 76, 6: 86, 7: 62 },
                7:  { name: "Julio",      1: 66, 2: 68, 3: 68, 4: 66, 5: 76, 6: 79, 7: 60 },
                8:  { name: "Agosto",     1: 68, 2: 71, 3: 71, 4: 68, 5: 76, 6: 81, 7: 62 },
                9:  { name: "Septiembre", 1: 72, 2: 75, 3: 75, 4: 72, 5: 79, 6: 86, 7: 64 },
                10: { name: "Octubre",    1: 72, 2: 75, 3: 75, 4: 72, 5: 79, 6: 86, 7: 64 },
                11: { name: "Noviembre",  1: 66, 2: 68, 3: 68, 4: 66, 5: 73, 6: 79, 7: 60 },
                12: { name: "Diciembre",  1: 62, 2: 64, 3: 64, 4: 62, 5: 70, 6: 75, 7: 58 }
            }
        }
    };

    // Escalados por ocupación por defecto (0-100%)
    const DEFAULT_OCC_TIERS = [
        { minOcc: 0,  maxOcc: 20, price: 62 },
        { minOcc: 21, maxOcc: 30, price: 62 },
        { minOcc: 31, maxOcc: 40, price: 62 },
        { minOcc: 41, maxOcc: 50, price: 62 },
        { minOcc: 51, maxOcc: 60, price: 62 },
        { minOcc: 61, maxOcc: 70, price: 70 },
        { minOcc: 71, maxOcc: 80, price: 75 },
        { minOcc: 81, maxOcc: 90, price: 85 },
        { minOcc: 91, maxOcc: 95, price: 95 },
        { minOcc: 96, maxOcc: 100, price: 110 }
    ];

    const STORAGE_KEY_MASTER_MATRIX = 'capasuite_pricing_matrix_master_v2';
    const STORAGE_KEY_MASTER_TIERS = 'capasuite_occ_tiers_master_v2';
    const STORAGE_KEY_SNAPSHOTS = 'daily_otb_snapshots_v1';
    const STORAGE_KEY_EXCEPTIONS = 'capasuite_pricing_exceptions_v1';

    const DOW_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const DOW_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const MONTH_NAMES_ES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Helper de almacenamiento seguro
    function getStoredItem(key) {
        try {
            if (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) {
                return CapaStorage.getItem(key);
            }
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(key);
            }
        } catch (e) {
            console.warn('[PricingIntelligence] Error al leer storage:', key, e);
        }
        return null;
    }

    function setStoredItem(key, val) {
        try {
            if (typeof CapaStorage !== 'undefined' && CapaStorage.setItem) {
                CapaStorage.setItem(key, val);
                return true;
            }
            if (typeof localStorage !== 'undefined') {
                localStorage.setItem(key, val);
                return true;
            }
        } catch (e) {
            console.warn('[PricingIntelligence] Error al escribir storage:', key, e);
        }
        return false;
    }

    // Normalizador de nombre de hotel
    function normalizeHotel(hotel) {
        if (!hotel) return 'Guadiana';
        const str = String(hotel).toLowerCase();
        if (str.includes('cumbria')) return 'Cumbria';
        return 'Guadiana';
    }

    // =========================================================================
    // 2. GESTIÓN MULTI-HOTEL Y MULTI-AÑO DE MATRICES DE TARIFAS BASE
    // =========================================================================
    function getMasterMatrixDB() {
        const raw = getStoredItem(STORAGE_KEY_MASTER_MATRIX);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) {}
        }
        return {};
    }

    function saveMasterMatrixDB(db) {
        if (!db || typeof db !== 'object') return false;
        return setStoredItem(STORAGE_KEY_MASTER_MATRIX, JSON.stringify(db));
    }

    /**
     * Obtiene la matriz de 12 meses x 7 días para un hotel y año dados.
     * Si no existe configuración personalizada, utiliza la matriz base oficial.
     */
    function getBarMatrix(hotel = 'Guadiana', year = 2027) {
        const hKey = normalizeHotel(hotel);
        const yKey = String(year);

        const master = getMasterMatrixDB();
        if (master[hKey] && master[hKey][yKey]) {
            return master[hKey][yKey];
        }

        // Fallback a clave legacy de 2027 si existe
        if (hKey === 'Guadiana' && yKey === '2027') {
            const legacyRaw = getStoredItem('capasuite_pricing_matrix_2027_v1');
            if (legacyRaw) {
                try {
                    const parsed = JSON.parse(legacyRaw);
                    if (parsed && typeof parsed === 'object' && parsed[1]) return parsed;
                } catch(e) {}
            }
        }

        // Fallback a los valores oficiales predeterminados
        if (DEFAULT_BAR_MATRICES[hKey] && DEFAULT_BAR_MATRICES[hKey][yKey]) {
            return JSON.parse(JSON.stringify(DEFAULT_BAR_MATRICES[hKey][yKey]));
        }

        // Si el año solicitado no está definido, generar a partir del año más próximo
        const fallbackRef = DEFAULT_BAR_MATRICES[hKey][2027] || DEFAULT_BAR_MATRICES['Guadiana'][2027];
        return JSON.parse(JSON.stringify(fallbackRef));
    }

    /**
     * Guarda la matriz de tarifas para un hotel y año dados.
     */
    function saveBarMatrix(hotel = 'Guadiana', year = 2027, matrix) {
        if (!matrix || typeof matrix !== 'object') return false;
        const hKey = normalizeHotel(hotel);
        const yKey = String(year);

        const master = getMasterMatrixDB();
        master[hKey] = master[hKey] || {};
        master[hKey][yKey] = matrix;

        return saveMasterMatrixDB(master);
    }

    /**
     * Copia tarifas de un hotel/año a otro con ajuste porcentual opcional.
     */
    function copyBarMatrix(fromHotel, fromYear, toHotel, toYear, pctAdjust = 0) {
        const source = getBarMatrix(fromHotel, fromYear);
        const clone = JSON.parse(JSON.stringify(source));

        if (pctAdjust !== 0) {
            const factor = 1 + (pctAdjust / 100);
            for (let m = 1; m <= 12; m++) {
                if (clone[m]) {
                    for (let d = 1; d <= 7; d++) {
                        if (clone[m][d]) {
                            clone[m][d] = Math.round(clone[m][d] * factor);
                        }
                    }
                }
            }
        }

        return saveBarMatrix(toHotel, toYear, clone);
    }

    function resetBarMatrixToDefault(hotel = 'Guadiana', year = 2027) {
        const hKey = normalizeHotel(hotel);
        const yKey = String(year);
        const defaultMatrix = (DEFAULT_BAR_MATRICES[hKey] && DEFAULT_BAR_MATRICES[hKey][yKey])
            ? DEFAULT_BAR_MATRICES[hKey][yKey]
            : DEFAULT_BAR_MATRICES['Guadiana'][2027];
        return saveBarMatrix(hKey, yKey, JSON.parse(JSON.stringify(defaultMatrix)));
    }

    // =========================================================================
    // 3. GESTIÓN DE ESCALADOS POR OCUPACIÓN (POR HOTEL, AÑO Y MES)
    // =========================================================================
    function getMasterTiersDB() {
        const raw = getStoredItem(STORAGE_KEY_MASTER_TIERS);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch(e) {}
        }
        return {};
    }

    function saveMasterTiersDB(db) {
        if (!db || typeof db !== 'object') return false;
        return setStoredItem(STORAGE_KEY_MASTER_TIERS, JSON.stringify(db));
    }

    function getOccTiers(hotel = 'Guadiana', year = 2027, month = 'all') {
        const hKey = normalizeHotel(hotel);
        const yKey = String(year);
        const mKey = String(month);

        const master = getMasterTiersDB();
        if (master[hKey] && master[hKey][yKey]) {
            if (master[hKey][yKey][mKey]) return master[hKey][yKey][mKey];
            if (master[hKey][yKey]['all']) return master[hKey][yKey]['all'];
        }

        // Factor según hotel: Cumbria tiene escalados de partida 3€ inferiores a Guadiana
        if (hKey === 'Cumbria') {
            return DEFAULT_OCC_TIERS.map(t => ({
                ...t,
                price: Math.max(45, t.price - 3)
            }));
        }
        return DEFAULT_OCC_TIERS.map(t => ({ ...t }));
    }

    function saveOccTiers(hotel = 'Guadiana', year = 2027, month = 'all', tiers) {
        if (!Array.isArray(tiers)) return false;
        const hKey = normalizeHotel(hotel);
        const yKey = String(year);
        const mKey = String(month);

        const master = getMasterTiersDB();
        master[hKey] = master[hKey] || {};
        master[hKey][yKey] = master[hKey][yKey] || {};
        master[hKey][yKey][mKey] = tiers;

        return saveMasterTiersDB(master);
    }

    // Compatibilidad retroactiva
    function getOccTiersJanFeb() {
        return getOccTiers('Guadiana', 2027, 'all');
    }
    function saveOccTiersJanFeb(tiers) {
        return saveOccTiers('Guadiana', 2027, 'all', tiers);
    }

    // =========================================================================
    // 4. EXCEPCIONES TARIFARIAS Y FECHAS ESPECIALES
    // =========================================================================
    function getPricingExceptions() {
        const raw = getStoredItem(STORAGE_KEY_EXCEPTIONS);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) {}
        }
        return {};
    }

    function savePricingExceptions(exceptions) {
        if (!exceptions || typeof exceptions !== 'object') return false;
        return setStoredItem(STORAGE_KEY_EXCEPTIONS, JSON.stringify(exceptions));
    }

    function setDateException(dateISO, data) {
        const all = getPricingExceptions();
        if (!data) {
            delete all[dateISO];
        } else {
            all[dateISO] = {
                barBase: Number(data.barBase) || 0,
                minPrice: Number(data.minPrice) || null,
                notes: String(data.notes || ''),
                eventName: String(data.eventName || ''),
                updatedAt: new Date().toISOString()
            };
        }
        return savePricingExceptions(all);
    }

    // Obtener la BAR base para una fecha específica considerando Hotel y Año
    function getBaseBarForDate(dateISO, hotelName = 'Guadiana') {
        if (!dateISO || typeof dateISO !== 'string') return { bar: 64, isException: false };
        
        // 1. Excepción específica de fecha
        const exceptions = getPricingExceptions();
        if (exceptions[dateISO] && exceptions[dateISO].barBase > 0) {
            return {
                bar: exceptions[dateISO].barBase,
                isException: true,
                eventName: exceptions[dateISO].eventName || '',
                notes: exceptions[dateISO].notes || ''
            };
        }

        const parts = dateISO.split('-');
        if (parts.length !== 3) return { bar: 64, isException: false };

        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        const day = parseInt(parts[2], 10);
        
        const dt = new Date(year, month - 1, day);
        let dow = dt.getDay(); // 0 = Domingo, 1 = Lunes .. 6 = Sábado
        let matrixDowKey = (dow === 0 ? 7 : dow); // Normalizamos: 1=Lun, 7=Dom

        const matrix = getBarMatrix(hotelName, year);
        const mRow = matrix[month];
        if (mRow && mRow[matrixDowKey] !== undefined) {
            return {
                bar: Number(mRow[matrixDowKey]),
                isException: false,
                dowName: DOW_NAMES_ES[dow],
                monthName: MONTH_NAMES_ES[month - 1]
            };
        }

        return { bar: 64, isException: false };
    }

    // =========================================================================
    // 5. HISTÓRICO DE SNAPSHOTS MULTI-HORIZONTE (DEDUPLICACIÓN Y PERSISTENCIA)
    // =========================================================================
    function getSnapshotsDB() {
        const raw = getStoredItem(STORAGE_KEY_SNAPSHOTS);
        if (raw) {
            try {
                const parsed = JSON.parse(raw);
                if (parsed && typeof parsed === 'object') return parsed;
            } catch (e) {
                console.warn('[PricingIntelligence] Error al parsear snapshots DB:', e);
            }
        }
        return { Guadiana: {}, Cumbria: {} };
    }

    function saveSnapshotsDB(db) {
        if (!db || typeof db !== 'object') return false;
        return setStoredItem(STORAGE_KEY_SNAPSHOTS, JSON.stringify(db));
    }

    function recordDailySnapshot(hotelName, dateISO, metrics, captureDate = new Date()) {
        if (!hotelName || !dateISO || !metrics) return false;
        const hKey = normalizeHotel(hotelName);
        const db = getSnapshotsDB();
        db[hKey] = db[hKey] || {};
        db[hKey][dateISO] = db[hKey][dateISO] || [];

        const capDt = (captureDate instanceof Date) ? captureDate : new Date(captureDate);
        const captureDayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(capDt);
        const timestamp = capDt.getTime();

        const entry = {
            captureDate: captureDayKey,
            timestamp: timestamp,
            rooms: Math.round(Number(metrics.rooms) || 0),
            revenue: Number(metrics.revenue) || 0,
            adr: (metrics.rooms > 0 && metrics.revenue > 0) ? (metrics.revenue / metrics.rooms) : (Number(metrics.adr) || 0),
            occupancyPct: Number(metrics.occupancyPct) || 0
        };

        const list = db[hKey][dateISO];
        const existingIdx = list.findIndex(item => item.captureDate === captureDayKey);
        if (existingIdx >= 0) {
            list[existingIdx] = entry;
        } else {
            list.push(entry);
        }

        list.sort((a, b) => a.timestamp - b.timestamp);
        if (list.length > 90) {
            db[hKey][dateISO] = list.slice(-90);
        }

        return saveSnapshotsDB(db);
    }

    function captureBatchSnapshots(hotelName, dailyMap, captureDate = new Date()) {
        if (!hotelName || !dailyMap || typeof dailyMap !== 'object') return 0;
        const hKey = normalizeHotel(hotelName);
        const db = getSnapshotsDB();
        db[hKey] = db[hKey] || {};

        const capDt = (captureDate instanceof Date) ? captureDate : new Date(captureDate);
        const captureDayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(capDt);
        const timestamp = capDt.getTime();
        const capacity = (hKey === 'Cumbria') ? 59 : 108;

        let count = 0;
        Object.entries(dailyMap).forEach(([iso, val]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
            const rooms = Math.round(typeof val === 'object' ? (val.rooms ?? val.otbRooms ?? 0) : Number(val) || 0);
            const revenue = typeof val === 'object' ? (val.revenue ?? 0) : 0;
            const adr = (rooms > 0 && revenue > 0) ? (revenue / rooms) : (typeof val === 'object' ? (val.adr || 0) : 0);
            const occPct = (rooms / capacity) * 100;

            db[hKey][iso] = db[hKey][iso] || [];
            const list = db[hKey][iso];
            const entry = {
                captureDate: captureDayKey,
                timestamp: timestamp,
                rooms: rooms,
                revenue: revenue,
                adr: adr,
                occupancyPct: occPct
            };

            const existingIdx = list.findIndex(item => item.captureDate === captureDayKey);
            if (existingIdx >= 0) {
                list[existingIdx] = entry;
            } else {
                list.push(entry);
            }

            if (list.length > 90) {
                db[hKey][iso] = list.slice(-90);
            }
            count++;
        });

        if (count > 0) {
            saveSnapshotsDB(db);
        }
        return count;
    }

    function calculateDailyPickup(hotelName, dateISO, currentMetrics = null, referenceDate = new Date()) {
        const hKey = normalizeHotel(hotelName);
        const result = {
            dateISO: dateISO,
            current: { rooms: 0, revenue: 0, adr: 0, occPct: 0 },
            h24h: { available: false, diffRooms: 0, diffRev: 0, adrPickup: 0, diffOccPct: 0, label: 'Sin histórico suficiente' },
            d3:   { available: false, diffRooms: 0, diffRev: 0, adrPickup: 0, diffOccPct: 0, label: 'Sin histórico suficiente' },
            d7:   { available: false, diffRooms: 0, diffRev: 0, adrPickup: 0, diffOccPct: 0, label: 'Sin histórico suficiente' },
            d14:  { available: false, diffRooms: 0, diffRev: 0, adrPickup: 0, diffOccPct: 0, label: 'Sin histórico suficiente' },
            d30:  { available: false, diffRooms: 0, diffRev: 0, adrPickup: 0, diffOccPct: 0, label: 'Sin histórico suficiente' },
            snapshotsCount: 0
        };

        const db = getSnapshotsDB();
        const list = (db[hKey] && db[hKey][dateISO]) ? db[hKey][dateISO] : [];
        result.snapshotsCount = list.length;

        let current = null;
        if (currentMetrics && currentMetrics.rooms !== undefined) {
            current = {
                rooms: Math.round(Number(currentMetrics.rooms) || 0),
                revenue: Number(currentMetrics.revenue) || 0,
                adr: (currentMetrics.rooms > 0 && currentMetrics.revenue > 0) 
                    ? (currentMetrics.revenue / currentMetrics.rooms) 
                    : (Number(currentMetrics.adr) || 0),
                occupancyPct: Number(currentMetrics.occupancyPct) || 0
            };
        } else if (list.length > 0) {
            current = list[list.length - 1];
        }

        if (!current) return result;
        result.current = current;

        // Si tenemos métrica directa de otbChange (pickup de la última carga / 24h)
        const instantPickup = (currentMetrics && currentMetrics.otbChange !== undefined && currentMetrics.otbChange !== null)
            ? Math.round(Number(currentMetrics.otbChange) || 0)
            : null;

        if (list.length === 0) {
            if (instantPickup !== null) {
                result.h24h = {
                    available: true,
                    diffRooms: instantPickup,
                    diffRev: 0,
                    adrPickup: 0,
                    diffOccPct: 0,
                    baselineRooms: current.rooms - instantPickup,
                    baselineDate: 'Última carga',
                    label: `${instantPickup >= 0 ? '+' : ''}${instantPickup} RN`
                };
            }
            return result;
        }

        const refTime = (referenceDate instanceof Date) ? referenceDate.getTime() : new Date(referenceDate).getTime();
        const MS_PER_DAY = 24 * 60 * 60 * 1000;

        const horizons = [
            { key: 'h24h', targetDays: 1,  minDays: 0.5, maxDays: 1.8 },
            { key: 'd3',   targetDays: 3,  minDays: 2.0, maxDays: 4.5 },
            { key: 'd7',   targetDays: 7,  minDays: 5.0, maxDays: 9.0 },
            { key: 'd14',  targetDays: 14, minDays: 11.0, maxDays: 18.0 },
            { key: 'd30',  targetDays: 30, minDays: 24.0, maxDays: 38.0 }
        ];

        horizons.forEach(h => {
            let bestMatch = null;
            let bestDeltaMs = Infinity;

            list.forEach(snap => {
                const ageDays = (refTime - snap.timestamp) / MS_PER_DAY;
                if (ageDays >= h.minDays && ageDays <= h.maxDays) {
                    const delta = Math.abs(ageDays - h.targetDays);
                    if (delta < bestDeltaMs) {
                        bestDeltaMs = delta;
                        bestMatch = snap;
                    }
                }
            });

            if (!bestMatch && h.key === 'h24h' && list.length >= 2) {
                const prev = list[list.length - 2];
                const ageDays = (refTime - prev.timestamp) / MS_PER_DAY;
                if (ageDays <= 2.5) bestMatch = prev;
            }

            if (bestMatch) {
                const diffRooms = current.rooms - bestMatch.rooms;
                const diffRev = current.revenue - bestMatch.revenue;
                const adrPickup = (diffRooms !== 0 && diffRev !== 0) ? (diffRev / diffRooms) : 0;
                const diffOccPct = current.occupancyPct - bestMatch.occupancyPct;

                result[h.key] = {
                    available: true,
                    diffRooms: diffRooms,
                    diffRev: diffRev,
                    adrPickup: adrPickup,
                    diffOccPct: diffOccPct,
                    baselineRooms: bestMatch.rooms,
                    baselineDate: bestMatch.captureDate,
                    label: `${diffRooms >= 0 ? '+' : ''}${diffRooms} RN`
                };
            } else if (h.key === 'h24h' && instantPickup !== null) {
                result.h24h = {
                    available: true,
                    diffRooms: instantPickup,
                    diffRev: 0,
                    adrPickup: 0,
                    diffOccPct: 0,
                    baselineRooms: current.rooms - instantPickup,
                    baselineDate: 'Última carga',
                    label: `${instantPickup >= 0 ? '+' : ''}${instantPickup} RN`
                };
            } else {
                result[h.key] = {
                    available: false,
                    diffRooms: 0,
                    diffRev: 0,
                    adrPickup: 0,
                    diffOccPct: 0,
                    label: 'Sin histórico suficiente'
                };
            }
        });

        return result;
    }

    // =========================================================================
    // 6. MOTOR DE RECOMENDACIÓN DIARIA INTELIGENTE
    // =========================================================================
    function evaluateDailyRecommendation(params) {
        const {
            hotelName = 'Guadiana',
            dateISO,
            currentPrice = 0,
            marketAvg = 0,
            lowestCompPrice = 0,
            highestCompPrice = 0,
            soldCompsCount = 0,
            otbRooms = 0,
            occupancyPct = 0,
            capacity = (normalizeHotel(hotelName) === 'Cumbria' ? 59 : 108),
            pickupData = null,
            minFloorPrice = (normalizeHotel(hotelName) === 'Cumbria' ? 50 : 60),
            customEvent = null
        } = params;

        // 1. Obtener BAR base de referencia configurada para ese Hotel y Fecha
        const baseInfo = getBaseBarForDate(dateISO, hotelName);
        let baseBar = baseInfo.bar;
        const isException = baseInfo.isException;
        const eventName = customEvent?.name || baseInfo.eventName || '';

        // Extraer fecha y antelación
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let daysOut = 999;
        let monthNum = 1;
        let yearNum = 2027;
        let dow = 1;

        if (dateISO && dateISO.includes('-')) {
            const parts = dateISO.split('-');
            yearNum = parseInt(parts[0], 10);
            monthNum = parseInt(parts[1], 10);
            const dy = parseInt(parts[2], 10);
            const targetDt = new Date(yearNum, monthNum - 1, dy);
            dow = targetDt.getDay();
            daysOut = Math.ceil((targetDt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        }

        // 2. Escalado por ocupación según mes configurado
        let occTierRefPrice = null;
        const tiers = getOccTiers(hotelName, yearNum, monthNum);
        const matchingTier = tiers.find(t => occupancyPct >= t.minOcc && occupancyPct <= t.maxOcc);
        if (matchingTier) {
            occTierRefPrice = matchingTier.price;
        }

        // 3. Evaluar Pick-up (Snapshot histórico o salto instantáneo del informe)
        const instantPickup = Number(params.otbChange) || 0;
        const p7d = (pickupData?.d7?.available) ? pickupData.d7.diffRooms : instantPickup;
        const p24h = (pickupData?.h24h?.available) ? pickupData.h24h.diffRooms : instantPickup;
        const p14d = (pickupData?.d14?.available) ? pickupData.d14.diffRooms : 0;
        const bestPickup = Math.max(p24h || 0, p7d || 0);

        // Indicador de histórico suficiente de pickup (al menos 2 capturas o métrica de 24h/7d disponible)
        const hasSufficientPickupHistory = !!(
            (pickupData && (pickupData.h24h?.available || pickupData.d7?.available || (pickupData.snapshotsCount && pickupData.snapshotsCount >= 2))) ||
            (params.otbChange !== undefined && params.otbChange !== null && params.otbChange !== 0)
        );

        const effectiveFloor = Math.max(minFloorPrice, 45);

        // 4. Cálculo del Rango Comercial Recomendado (Suelo y Techo objetivos)
        // Suelo: BAR Base de la fecha o tramo de escalado según ocupación (nunca inferior al suelo mínimo)
        const commercialFloor = Math.max(effectiveFloor, (occupancyPct >= 61 && occTierRefPrice) ? occTierRefPrice : baseBar);
        let commercialCeiling = commercialFloor;
        let rangeCalculation = '';

        if (marketAvg > 0) {
            if (occupancyPct <= 60) {
                // Con ocupación <= 60%, el techo comercial respeta el set competitivo con margen según antelación
                const mktCeil = Math.round(marketAvg * (daysOut > 30 ? 1.05 : 1.10));
                commercialCeiling = Math.max(commercialFloor, mktCeil);
                rangeCalculation = `Suelo: BAR base configurada (${commercialFloor} €) · Techo: Media competidores (${Math.round(marketAvg)} €) +${daysOut > 30 ? '5%' : '10%'} antelación (${commercialCeiling} €)`;
            } else {
                // Con ocupación > 60%, el techo lo marca el escalado superior o mercado +15%
                const highCeil = Math.round(Math.max((occTierRefPrice || baseBar) * 1.10, marketAvg * 1.15));
                commercialCeiling = Math.max(commercialFloor, highCeil);
                rangeCalculation = `Suelo: Escalado ocupación ${occupancyPct.toFixed(0)}% (${commercialFloor} €) · Techo: Presión demanda sobre mercado (${commercialCeiling} €)`;
            }
        } else {
            commercialCeiling = Math.round(commercialFloor * (occupancyPct >= 61 ? 1.15 : 1.08));
            rangeCalculation = `Suelo: ${occupancyPct >= 61 ? 'Escalado ocupación' : 'BAR base'} (${commercialFloor} €) · Techo: Margen estratégico de antelación (${commercialCeiling} €)`;
        }

        const minRange = commercialFloor;
        const maxRange = Math.max(commercialFloor, commercialCeiling);
        const rangeText = (minRange === maxRange) ? `${minRange} €` : `${minRange} € – ${maxRange} €`;

        // Banda matemática de tolerancia puramente aritmética (±5% sobre precio publicado actual)
        const currentRef = currentPrice > 0 ? currentPrice : baseBar;
        const mathTolMin = Math.round(currentRef * 0.95);
        const mathTolMax = Math.round(currentRef * 1.05);
        const mathToleranceBand = {
            min: mathTolMin,
            max: mathTolMax,
            text: (mathTolMin === mathTolMax) ? `${mathTolMin} €` : `${mathTolMin} € – ${mathTolMax} €`
        };

        // 5. Lógica de Decisión Estratégica
        let action = 'MANTENER';
        let target = (currentPrice > 0) ? currentPrice : baseBar;
        let triggerText = 'En Rango';
        let demandStatus = 'EN RANGO COMERCIAL';
        let isCommerciallyOptimal = false;
        let reasons = [];
        let riskAssessment = 'Riesgo bajo';
        let confidenceScore = 'Alta';

        // === CASO 1: SITUACIÓN CRÍTICA / OVERBOOKING (>=100% o >=capacidad) ===
        if (occupancyPct >= 100 || otbRooms >= capacity) {
            action = 'REVISIÓN MANUAL';
            const extra = (marketAvg > target) ? Math.round((marketAvg - target) * 0.5) + 15 : 20;
            target = Math.max(target + extra, Math.round(marketAvg * 1.15));
            triggerText = '100% LLENO';
            demandStatus = 'OVERBOOKING / LLENO';
            reasons.push(`Hotel al 100% de capacidad (${otbRooms}/${capacity} habs). Proteger inventario y cerrar canales de distribución.`);
            riskAssessment = 'Riesgo alto de overbooking / desvíos.';
            confidenceScore = 'Muy Alta';
        }
        // === CASO 2: OCUPACIÓN MUY ALTA / ÚLTIMAS HABITACIONES (91% - 99%) ===
        else if (occupancyPct >= 91) {
            const leftRooms = Math.max(1, capacity - otbRooms);
            if (target < occTierRefPrice) {
                action = 'SUBIR';
                target = occTierRefPrice;
                triggerText = `🔥 Escalado ${occTierRefPrice}€ (${leftRooms} lib)`;
                demandStatus = 'SUBIDA POR ESCALADO CRÍTICO';
                reasons.push(`Ocupación crítica (${occupancyPct.toFixed(0)}% · ${leftRooms} habs libres). Subir a tramo de escalado (${occTierRefPrice} €).`);
            } else {
                action = 'MANTENER';
                triggerText = `🔥 Ocup. ${occupancyPct.toFixed(0)}% (${leftRooms} lib)`;
                demandStatus = 'EN ESCALADO CRÍTICO';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación crítica (${occupancyPct.toFixed(0)}% · ${leftRooms} habs libres). Tarifa actual (${target} €) cubre el tramo de escalado (${occTierRefPrice} €).`);
            }
            if (bestPickup > 0) reasons.push(`Pick-up positivo (+${bestPickup} RN) confirma tracción.`);
        }
        // === CASO 3: ESCALADO DE OCUPACIÓN ACTIVO (61% - 90%) ===
        else if (occupancyPct >= 61 && occTierRefPrice) {
            if (target < occTierRefPrice) {
                action = 'SUBIR';
                target = occTierRefPrice;
                triggerText = `📈 Escalado ${occTierRefPrice}€`;
                demandStatus = 'SUBIDA POR ESCALADO';
                reasons.push(`Ocupación en tramo ${occupancyPct.toFixed(0)}%. Alinear tarifa con escalado estratégico (${occTierRefPrice} €).`);
            } else {
                action = 'MANTENER';
                triggerText = `En Escalado (${occTierRefPrice}€)`;
                demandStatus = 'EN ESCALADO';
                isCommerciallyOptimal = true;
                reasons.push(`Tarifa actual (${target} €) cumple con el escalado para ocupación del ${occupancyPct.toFixed(0)}% (${occTierRefPrice} €).`);
            }
        }
        // === CASO 4: PICK-UP ACELERADO (MOMENTUM DE VENTAS >= 5 RN) ===
        else if (bestPickup >= 5) {
            action = 'SUBIR';
            if (marketAvg > target) {
                const gap = marketAvg - target;
                const ratio = (bestPickup >= 15) ? 0.45 : ((bestPickup >= 10) ? 0.35 : 0.25);
                const step = Math.min(20, Math.max(6, Math.round(gap * ratio)));
                target = target + step;
            } else {
                const step = (bestPickup >= 10) ? 8 : 4;
                target = target + step;
            }
            triggerText = `⚡ Pick-up +${bestPickup}`;
            demandStatus = 'MOMENTUM DE VENTAS';
            reasons.push(`Aceleración notable de reservas (Pick-up +${bestPickup} RN). Ritmo superior a la media.`);
            if (marketAvg > 0 && target < marketAvg) {
                reasons.push(`Margen de subida respecto a la media de mercado (${marketAvg.toFixed(0)} €).`);
            }
        }
        // === CASO 5: PRESIÓN COMPETITIVA (COMPETIDORES LLENOS EN LA PLAZA) ===
        else if (soldCompsCount >= 2 && occupancyPct >= 45) {
            action = 'SUBIR';
            target = target + 5;
            triggerText = `🏢 Comps llenos (${soldCompsCount})`;
            demandStatus = 'PRESIÓN COMPETITIVA';
            reasons.push(`${soldCompsCount} hoteles competidores llenos o sin ventas abiertas en la plaza.`);
        }
        // === CASO 6: OCUPACIÓN BAJA DE ÚLTIMA HORA (<7 DÍAS) - REGLA DE SEGURIDAD ===
        else if (daysOut >= 0 && daysOut <= 7 && occupancyPct < 40) {
            action = 'MANTENER';
            target = currentPrice;
            triggerText = `🛡️ Proteger ADR (${daysOut}d)`;
            demandStatus = 'PROTECCIÓN ADR ÚLTIMA HORA';
            reasons.push(`Baja ocupación (${occupancyPct.toFixed(0)}%) con antelación corta (${daysOut} días). Criterio Revenue: No bajar BAR general; mantener tarifa para proteger ADR.`);
            riskAssessment = 'Evitar devaluación de tarifa pública de última hora.';
            confidenceScore = 'Media';
        }
        // === CASO 7: SIN HISTÓRICO SUFICIENTE DE PICK-UP (OBSERVACIÓN Y PRUDENCIA) ===
        else if (!hasSufficientPickupHistory) {
            action = 'MANTENER';
            target = currentPrice > 0 ? currentPrice : baseBar;
            confidenceScore = 'Media';
            riskAssessment = 'Pendiente de verificar tracción real de reservas.';

            if (currentPrice > 0 && currentPrice !== baseBar) {
                triggerText = '⚠️ Pend. Demanda';
                demandStatus = 'PENDIENTE DE EVALUACIÓN DE DEMANDA';
                isCommerciallyOptimal = false;
                const gapVsMkt = (marketAvg > 0) ? Math.round(((currentPrice - marketAvg) / marketAvg) * 100) : 0;
                reasons.push(`Antelación de ${daysOut} días con ocupación del ${occupancyPct.toFixed(0)}% (tramo base 0–60%).`);
                reasons.push(`Precio publicado actual (${currentPrice} €) difiere de la BAR base (${baseBar} €)${marketAvg > 0 ? ` y se sitúa ${gapVsMkt > 0 ? '+' : ''}${gapVsMkt}% sobre la media de mercado (${Math.round(marketAvg)} €)` : ''}.`);
                reasons.push(`MANTENER — PENDIENTE DE EVALUACIÓN DE DEMANDA: Sin histórico de pickup suficiente para confirmar sobredemanda que justifique la prima sobre el mercado y la BAR base. Se mantiene tarifa en observación.`);
                reasons.push(`Rango comercial recomendado para este tramo: ${rangeText} (${rangeCalculation}).`);
            } else {
                triggerText = `En BAR Base (${baseBar}€)`;
                demandStatus = 'EN BAR BASE';
                isCommerciallyOptimal = true;
                reasons.push(`Tarifa alineada exactamente con la BAR base de partida (${baseBar} €).`);
                reasons.push(`Histórico de pickup en fase de captura inicial.`);
                reasons.push(`Rango comercial recomendado: ${rangeText} (${rangeCalculation}).`);
            }
        }
        // === CASO 8: CON HISTÓRICO DE PICK-UP - OCUPACIÓN MODERADA (0–60%) ===
        else {
            if (bestPickup >= 3) {
                action = 'MANTENER';
                triggerText = `⚡ Tracción +${bestPickup}`;
                demandStatus = 'DEMANDA ACTIVA';
                isCommerciallyOptimal = true;
                reasons.push(`Tracción positiva de reservas (Pick-up +${bestPickup} RN) confirma solidez de la tarifa.`);
                reasons.push(`Rango comercial recomendado: ${rangeText} (${rangeCalculation}).`);
            } else if (currentPrice > maxRange && daysOut > 14 && bestPickup <= 1) {
                action = 'REVISAR BAJADA';
                target = Math.max(minRange, Math.round(marketAvg || baseBar));
                triggerText = `Alinear a Rango (${target}€)`;
                demandStatus = 'POR ENCIMA DE RANGO';
                isCommerciallyOptimal = false;
                reasons.push(`Antelación de ${daysOut} días con ocupación moderada (${occupancyPct.toFixed(0)}%) y sin ritmo de pickup.`);
                reasons.push(`Precio publicado (${currentPrice} €) supera el rango comercial máximo (${maxRange} €). Revisar hacia ${target} €.`);
                reasons.push(`Rango comercial de referencia: ${rangeText} (${rangeCalculation}).`);
            } else if (currentPrice < minRange) {
                action = 'SUBIR';
                target = minRange;
                triggerText = `Alinear a BAR (${minRange}€)`;
                demandStatus = 'POR DEBAJO DE RANGO';
                isCommerciallyOptimal = false;
                reasons.push(`Tarifa actual (${currentPrice} €) por debajo del suelo comercial (${minRange} €). Subir a BAR base.`);
                reasons.push(`Rango comercial de referencia: ${rangeText} (${rangeCalculation}).`);
            } else {
                action = 'MANTENER';
                triggerText = 'En Rango';
                demandStatus = 'EN RANGO COMERCIAL';
                isCommerciallyOptimal = true;
                reasons.push(`Precio actual (${currentPrice} €) comercialmente adecuado dentro del rango estratégico (${rangeText}).`);
                reasons.push(`Evolución de ocupación (${occupancyPct.toFixed(0)}%) y pickup en parámetros previstos.`);
                reasons.push(`Cálculo de rango: ${rangeCalculation}.`);
            }
        }

        if (occTierRefPrice && occTierRefPrice > 0) {
            reasons.push(`Referencia de escalado (${occupancyPct.toFixed(0)}% ocupación): ${occTierRefPrice} €.`);
        }

        if (target < effectiveFloor) {
            target = effectiveFloor;
            reasons.push(`Aplicado suelo mínimo inviolable configurado (${effectiveFloor} €).`);
        }

        const roundedProposed = Math.round(target);
        const roundedCurrent = Math.round(currentPrice > 0 ? currentPrice : baseBar);
        const diffAmount = roundedProposed - roundedCurrent;
        const diffPct = (roundedCurrent > 0) ? ((diffAmount / roundedCurrent) * 100) : 0;

        if (action === 'SUBIR' && diffAmount <= 0) action = 'MANTENER';
        if (action === 'REVISAR BAJADA' && diffAmount >= 0) action = 'MANTENER';

        return {
            dateISO,
            hotelName,
            action,
            baseBar,
            currentPrice: roundedCurrent,
            proposedPrice: roundedProposed,
            minFloorPrice: effectiveFloor,
            occTierRefPrice,
            diffAmount,
            diffPct,
            daysOut,
            reasons,
            fullReasonText: reasons.join(' '),
            confidenceScore,
            riskAssessment,
            isException,
            eventName,
            triggerText,
            demandStatus,
            isCommerciallyOptimal,
            hasSufficientPickupHistory,
            minRange,
            maxRange,
            rangeText,
            rangeCalculation,
            mathToleranceBand
        };
    }

    // =========================================================================
    // 7. AGREGACIONES MENSUALES Y POR DÍA DE LA SEMANA (SIN DUPLICACIONES)
    // =========================================================================
    function aggregateByDayOfWeek(datesList, selectedMonthNum, hotelName = 'Guadiana', year = 2027) {
        const capacity = (normalizeHotel(hotelName) === 'Cumbria' ? 59 : 108);
        const daysOfWeek = [
            { dow: 1, name: 'Lunes',      short: 'Lun' },
            { dow: 2, name: 'Martes',     short: 'Mar' },
            { dow: 3, name: 'Miércoles',  short: 'Mié' },
            { dow: 4, name: 'Jueves',     short: 'Jue' },
            { dow: 5, name: 'Viernes',    short: 'Vie' },
            { dow: 6, name: 'Sábado',     short: 'Sáb' },
            { dow: 7, name: 'Domingo',    short: 'Dom' }
        ];

        const seenDates = new Set();
        const filteredDates = [];

        (datesList || []).forEach(d => {
            if (!d || !d.dateISO || seenDates.has(d.dateISO)) return;
            const parts = d.dateISO.split('-');
            if (parts.length === 3) {
                const m = parseInt(parts[1], 10);
                if (m === selectedMonthNum) {
                    seenDates.add(d.dateISO);
                    filteredDates.push(d);
                }
            }
        });

        const activeYear = (filteredDates[0]?.dateISO) ? parseInt(filteredDates[0].dateISO.split('-')[0], 10) : year;
        const matrix = getBarMatrix(hotelName, activeYear);
        const mRow = matrix[selectedMonthNum] || {};

        return daysOfWeek.map(dayObj => {
            const matchingDates = filteredDates.filter(d => {
                const parts = d.dateISO.split('-');
                const dt = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                let dNum = dt.getDay();
                let dowKey = (dNum === 0 ? 7 : dNum);
                return dowKey === dayObj.dow;
            });

            const count = matchingDates.length;
            const baseBar = mRow[dayObj.dow] || 64;

            if (count === 0) {
                return {
                    dow: dayObj.dow,
                    name: dayObj.name,
                    short: dayObj.short,
                    count: 0,
                    dates: [],
                    baseBar: baseBar,
                    avgCurrentPrice: 0,
                    avgOccupancyPct: 0,
                    avgOtbRooms: 0,
                    pickupNet24h: 0,
                    pickupNet7d: 0,
                    pickupNet14d: 0,
                    pickupNet30d: 0,
                    hasPickupHistory: false,
                    avgMarketPrice: 0,
                    recommendedPrice: baseBar,
                    justification: 'Sin fechas cargadas para este día del mes.'
                };
            }

            let sumPrice = 0;
            let sumRooms = 0;
            let sumMarket = 0;
            let countMarket = 0;
            let sumP24h = 0;
            let sumP7d = 0;
            let sumP14d = 0;
            let sumP30d = 0;
            let hasHistoryAny = false;
            let sumProposed = 0;

            const dateDetails = matchingDates.map(d => {
                const my = d.hotels ? d.hotels[hotelName] : null;
                const price = (my && !my.sold && my.price > 0) ? my.price : baseBar;
                const rooms = Math.round(d.otbRooms || (my ? (my.otbRooms ?? my.occupancy) : 0) || 0);
                const occPct = (rooms / capacity) * 100;
                const mkt = Number(d.compAvg) || 0;
                const otbChange = my?.otbChange || 0;

                sumPrice += price;
                sumRooms += rooms;
                if (mkt > 0) {
                    sumMarket += mkt;
                    countMarket++;
                }

                const pData = calculateDailyPickup(hotelName, d.dateISO, { rooms, occupancyPct: occPct, otbChange });
                if (pData.h24h.available) { sumP24h += pData.h24h.diffRooms; hasHistoryAny = true; }
                if (pData.d7.available)   { sumP7d += pData.d7.diffRooms;   hasHistoryAny = true; }
                if (pData.d14.available)  { sumP14d += pData.d14.diffRooms; hasHistoryAny = true; }
                if (pData.d30.available)  { sumP30d += pData.d30.diffRooms; hasHistoryAny = true; }

                const rec = evaluateDailyRecommendation({
                    hotelName,
                    dateISO: d.dateISO,
                    currentPrice: price,
                    marketAvg: mkt,
                    otbRooms: rooms,
                    occupancyPct: occPct,
                    otbChange: otbChange,
                    pickupData: pData
                });

                sumProposed += rec.proposedPrice;

                return {
                    dateISO: d.dateISO,
                    label: d.label || d.dateISO,
                    price: price,
                    rooms: rooms,
                    occPct: occPct,
                    marketPrice: mkt,
                    pickup24h: pData.h24h.available ? pData.h24h.diffRooms : null,
                    pickup7d: pData.d7.available ? pData.d7.diffRooms : null,
                    pickup14d: pData.d14.available ? pData.d14.diffRooms : null,
                    recommendation: rec
                };
            });

            const avgPrice = Math.round(sumPrice / count);
            const avgRooms = Math.round(sumRooms / count);
            const avgOcc = (avgRooms / capacity) * 100;
            const avgMkt = countMarket > 0 ? Math.round(sumMarket / countMarket) : 0;
            const avgRecommended = Math.round(sumProposed / count);

            let just = '';
            if (avgOcc >= 80) {
                just = `Ocupación elevada (${avgOcc.toFixed(0)}% media). Mantener tarifas firmes o subir en fechas punta.`;
            } else if (sumP7d >= (count * 2)) {
                just = `Demanda activa con pick-up positivo acumulado (+${sumP7d} RN en 7d).`;
            } else if (avgOcc < 35 && avgPrice > baseBar) {
                just = `Ocupación moderada (${avgOcc.toFixed(0)}%). Tarifa actual próxima a la BAR base.`;
            } else {
                just = `Comportamiento estable. Orientación basada en BAR de referencia (${baseBar} €).`;
            }

            return {
                dow: dayObj.dow,
                name: dayObj.name,
                short: dayObj.short,
                count: count,
                dates: dateDetails,
                baseBar: baseBar,
                avgCurrentPrice: avgPrice,
                avgOccupancyPct: avgOcc,
                avgOtbRooms: avgRooms,
                pickupNet24h: hasHistoryAny ? sumP24h : null,
                pickupNet7d: hasHistoryAny ? sumP7d : null,
                pickupNet14d: hasHistoryAny ? sumP14d : null,
                pickupNet30d: hasHistoryAny ? sumP30d : null,
                hasPickupHistory: hasHistoryAny,
                avgMarketPrice: avgMkt,
                recommendedPrice: avgRecommended,
                justification: just
            };
        });
    }

    function aggregateMonthSummary(datesList, selectedMonthNum, hotelName = 'Guadiana', year = 2027) {
        const capacity = (normalizeHotel(hotelName) === 'Cumbria' ? 59 : 108);
        const seen = new Set();
        const monthDates = (datesList || []).filter(d => {
            if (!d || !d.dateISO || seen.has(d.dateISO)) return false;
            const parts = d.dateISO.split('-');
            if (parts.length === 3 && parseInt(parts[1], 10) === selectedMonthNum) {
                seen.add(d.dateISO);
                return true;
            }
            return false;
        });

        const totalDays = monthDates.length;
        const detectedYear = (monthDates[0]?.dateISO) ? monthDates[0].dateISO.split('-')[0] : String(year);
        if (totalDays === 0) {
            return {
                year: detectedYear,
                monthNum: selectedMonthNum,
                monthName: MONTH_NAMES_ES[selectedMonthNum - 1],
                totalDays: 0,
                avgOccPct: 0,
                totalSoldRooms: 0,
                totalAvailableRooms: 0,
                forecastADR: 0,
                avgCurrentPrice: 0,
                avgRecommendedPrice: 0,
                forecastRevenue: 0,
                pickupAccum7d: null,
                pickupAccum14d: null,
                pickupAccum30d: null,
                avgMarketPrice: 0,
                compGapPct: 0
            };
        }

        let sumRooms = 0;
        let sumRevenue = 0;
        let sumPrice = 0;
        let sumMkt = 0;
        let countMkt = 0;
        let sumRec = 0;
        let p24hSum = 0;
        let p7dSum = 0;
        let p14dSum = 0;
        let p30dSum = 0;
        let hasHist = false;

        monthDates.forEach(d => {
            const my = d.hotels ? d.hotels[hotelName] : null;
            const baseInfo = getBaseBarForDate(d.dateISO, hotelName);
            const price = (my && !my.sold && my.price > 0) ? my.price : baseInfo.bar;
            const rooms = Math.round(d.otbRooms || (my ? (my.otbRooms ?? my.occupancy) : 0) || 0);
            const occPct = (rooms / capacity) * 100;
            const mkt = Number(d.compAvg) || 0;
            const otbChange = my?.otbChange || 0;

            sumRooms += rooms;
            sumRevenue += (rooms * price);
            sumPrice += price;
            if (mkt > 0) {
                sumMkt += mkt;
                countMkt++;
            }

            const pData = calculateDailyPickup(hotelName, d.dateISO, { rooms, occupancyPct: occPct, otbChange });
            if (pData.h24h.available) { p24hSum += pData.h24h.diffRooms; hasHist = true; }
            if (pData.d7.available)  { p7dSum += pData.d7.diffRooms;   hasHist = true; }
            if (pData.d14.available) { p14dSum += pData.d14.diffRooms; hasHist = true; }
            if (pData.d30.available) { p30dSum += pData.d30.diffRooms; hasHist = true; }

            const rec = evaluateDailyRecommendation({
                hotelName,
                dateISO: d.dateISO,
                currentPrice: price,
                marketAvg: mkt,
                otbRooms: rooms,
                occupancyPct: occPct,
                otbChange: otbChange,
                pickupData: pData
            });
            sumRec += rec.proposedPrice;
        });

        const totalAvail = totalDays * capacity;
        const avgOcc = totalAvail > 0 ? (sumRooms / totalAvail) * 100 : 0;
        const avgCur = Math.round(sumPrice / totalDays);
        const avgMkt = countMkt > 0 ? Math.round(sumMkt / countMkt) : 0;
        const avgRec = Math.round(sumRec / totalDays);
        const forecastADR = sumRooms > 0 ? (sumRevenue / sumRooms) : avgCur;
        const compGap = (avgCur > 0 && avgMkt > 0) ? (((avgCur - avgMkt) / avgMkt) * 100) : 0;

        return {
            year: detectedYear,
            monthNum: selectedMonthNum,
            monthName: MONTH_NAMES_ES[selectedMonthNum - 1],
            totalDays: totalDays,
            avgOccPct: avgOcc,
            totalSoldRooms: sumRooms,
            totalAvailableRooms: totalAvail,
            forecastADR: Math.round(forecastADR),
            avgCurrentPrice: avgCur,
            avgRecommendedPrice: avgRec,
            forecastRevenue: Math.round(sumRevenue),
            pickupAccum24h: hasHist ? p24hSum : null,
            pickupAccum7d: hasHist ? p7dSum : null,
            pickupAccum14d: hasHist ? p14dSum : null,
            pickupAccum30d: hasHist ? p30dSum : null,
            avgMarketPrice: avgMkt,
            compGapPct: compGap
        };
    }

    const api = {
        DEFAULT_BAR_MATRICES,
        DEFAULT_OCC_TIERS,
        DOW_NAMES_ES,
        MONTH_NAMES_ES,
        normalizeHotel,
        getBarMatrix,
        saveBarMatrix,
        copyBarMatrix,
        resetBarMatrixToDefault,
        getOccTiers,
        saveOccTiers,
        getOccTiersJanFeb,
        saveOccTiersJanFeb,
        getPricingExceptions,
        savePricingExceptions,
        setDateException,
        getBaseBarForDate,
        getSnapshotsDB,
        saveSnapshotsDB,
        recordDailySnapshot,
        captureBatchSnapshots,
        calculateDailyPickup,
        evaluateDailyRecommendation,
        aggregateByDayOfWeek,
        aggregateMonthSummary
    };

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.PricingIntelligence = api;

})(typeof window === 'object' ? window : globalThis);
