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

    // =========================================================================
    // ESCALADO DINÁMICO BAR 2027 (INSTRUCCIONES OFICIALES REVENUE MANAGEMENT)
    // Hoteles: Sercotel Guadiana y Cumbria Spa&Hotel
    // Los porcentajes no son acumulativos entre tramos: se calculan directamente sobre la BAR base
    // =========================================================================
    const DEFAULT_DYNAMIC_SCALE_TIERS = [
        { minOcc: 0,  maxOcc: 20, incPct: 0,  action: 'Mantener', label: 'Mantener' },
        { minOcc: 21, maxOcc: 30, incPct: 0,  action: 'Mantener', label: 'Mantener' },
        { minOcc: 31, maxOcc: 40, incPct: 0,  action: 'Mantener', label: 'Mantener' },
        { minOcc: 41, maxOcc: 50, incPct: 0,  action: 'Mantener', label: 'Vigilar pickup' },
        { minOcc: 51, maxOcc: 60, incPct: 5,  action: 'Subir',    label: 'Primera subida (+5% condicionado)' },
        { minOcc: 61, maxOcc: 70, incPct: 13, action: 'Subir',    label: 'Subir (+13%)' },
        { minOcc: 71, maxOcc: 80, incPct: 21, action: 'Subir',    label: 'Subir (+21%)' },
        { minOcc: 81, maxOcc: 90, incPct: 37, action: 'Subir',    label: 'Proteger inventario (+37%)' },
        { minOcc: 91, maxOcc: 95, incPct: 53, action: 'Subir',    label: 'Limitar descuentos (+53%)' },
        { minOcc: 96, maxOcc: 100, incPct: 77, action: 'Subir',   label: 'Maximizar ingresos (+77%)' }
    ];

    // Umbrales según antelación (Sección 4)
    const ANTICIPATION_THRESHOLDS = [
        { minDays: 61, maxDays: 9999, firstReviewOcc: 35, strongHikeOcc: 55, label: 'Más de 60 días' },
        { minDays: 31, maxDays: 60,   firstReviewOcc: 40, strongHikeOcc: 60, label: '31–60 días' },
        { minDays: 15, maxDays: 30,   firstReviewOcc: 45, strongHikeOcc: 65, label: '15–30 días' },
        { minDays: 8,  maxDays: 14,   firstReviewOcc: 50, strongHikeOcc: 70, label: '8–14 días' },
        { minDays: 0,  maxDays: 7,    firstReviewOcc: 60, strongHikeOcc: 80, label: '0–7 días' }
    ];

    const STORAGE_KEY_MASTER_MATRIX = 'capasuite_pricing_matrix_master_v2';
    const STORAGE_KEY_MASTER_TIERS = 'capasuite_occ_tiers_master_v2';
    const STORAGE_KEY_SNAPSHOTS = 'daily_otb_snapshots_v1';
    const STORAGE_KEY_EXCEPTIONS = 'capasuite_pricing_exceptions_v1';
    const STORAGE_KEY_DYNAMIC_SCALE_TIERS = 'capasuite_dynamic_scale_tiers_v1';
    const STORAGE_KEY_PRICING_DECISIONS = 'capasuite_pricing_decisions_v1';

    const DOW_NAMES_ES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const DOW_SHORT_ES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const MONTH_NAMES_ES = [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];

    // Helper de almacenamiento seguro
    const _memoryStorage = new Map();

    function getStoredItem(key) {
        try {
            if (typeof CapaStorage !== 'undefined' && CapaStorage.getItem) {
                return CapaStorage.getItem(key);
            }
            if (typeof localStorage !== 'undefined') {
                return localStorage.getItem(key);
            }
            if (_memoryStorage.has(key)) {
                return _memoryStorage.get(key);
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
            _memoryStorage.set(key, String(val));
            return true;
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
    // 4B. PRESUPUESTO OFICIAL MENSUAL 2027 & 2026 (RECONCILIACIÓN Y CONTROL)
    // Sercotel Guadiana V2 (108 habs) & Cumbria Spa & Hotel (59 habs)
    // =========================================================================
    const OFFICIAL_BUDGET_2027 = {
        Guadiana: {
            scenario: 'V2',
            hotel: 'Guadiana',
            note: 'Presupuesto Oficial 2027 V2 Sercotel Guadiana (108 habitaciones). 1.575.124,93 € / 22.954 RN / 68,62 € ADR / 58,23% Occ. Sin asumir crecimiento 7,5% sobre cierre 2026 sin validar base.',
            capacity: 108,
            annualAvailableRN: 39420,
            annualRevenue: 1575124.93,
            annualRN: 22954,
            annualADR: 68.62,
            annualOccPct: 58.23,
            //         Ene     Feb     Mar      Abr      May      Jun      Jul      Ago      Sep      Oct      Nov      Dic
            rev: [  70866,  85178, 121998,  147962,  200620,  142146,  116525,  151078,  150492,  173575,  113556,  101128 ],
            adr: [  63.27,  62.49,  72.62,   61.78,   82.05,   74.00,   68.50,   69.69,   66.50,   68.53,   62.22,   65.67 ],
            rn:  [   1120,   1363,   1680,    2395,    2445,    1921,    1701,    2168,    2263,    2533,    1825,    1540 ]
        },
        Cumbria: {
            scenario: 'Oficial 2027',
            hotel: 'Cumbria',
            note: 'Presupuesto 2027 Cumbria Spa & Hotel (59 habitaciones). 992.145,45 € / 15.434 RN / 64,28 € ADR / 71,67% Occ. Crecimiento +7,50% sobre base 2026 (922.926 €). Sin considerar la 4ª estrella como categoría reconocida.',
            capacity: 59,
            annualAvailableRN: 21535,
            annualRevenue: 992145.45,
            annualRN: 15434,
            annualADR: 64.28,
            annualOccPct: 71.67,
            //         Ene     Feb     Mar      Abr      May      Jun      Jul      Ago      Sep      Oct      Nov      Dic
            rev: [  50949,  51684,  74623,   90604,  107569,   83637,   82135,   80777,   83835,  108129,   94745,   83459 ],
            adr: [  54.32,  54.81,  63.73,   68.02,   70.63,   61.91,   59.22,   56.41,   61.92,   66.83,   74.84,   74.58 ],
            rn:  [    938,    943,   1171,    1332,    1523,    1351,    1387,    1432,    1354,    1618,    1266,    1119 ]
        }
    };

    const OFFICIAL_BUDGET_2026 = {
        Guadiana: {
            scenario: 'Aprobado 2026',
            hotel: 'Guadiana',
            note: 'Presupuesto Oficial 2026 Sercotel Guadiana (108 habitaciones). 1.395.371 € / 21.232 RN / 65,72 € ADR / 56,96% Occ.',
            capacity: 108,
            annualAvailableRN: 39420,
            annualRevenue: 1395371,
            annualRN: 21232,
            annualADR: 65.72,
            annualOccPct: 56.96,
            rev: [ 66789, 71441, 106875, 130251, 125308, 118652, 121962, 131039, 148593, 163911, 114738, 95813 ],
            adr: [ 61.50, 61.80,  75.00,  70.33,  69.50,  70.50,  69.10,  61.09,  62.91,  62.16,  64.28, 62.50 ],
            rn:  [  1086,  1156,   1425,   1852,   1803,   1683,   1765,   2145,   2362,   2637,   1785,  1533 ]
        },
        Cumbria: {
            scenario: 'Aprobado 2026',
            hotel: 'Cumbria',
            note: 'Presupuesto 2026 Cumbria Spa & Hotel (59 habitaciones).',
            capacity: 59,
            annualAvailableRN: 21535,
            annualRevenue: 1255000,
            annualRN: 15484,
            annualADR: 81.05,
            annualOccPct: 71.90,
            rev: [ 66000, 69000, 81000, 101000, 118000, 108000, 126000, 118000, 116000, 111000, 96000, 86000 ],
            adr: [ 70.00, 70.00, 75.00,  78.00,  87.00,  83.00,  91.00,  87.00,  86.00,  81.00,  78.00, 77.00 ],
            rn:  [   943,   986,  1080,   1295,   1356,   1301,   1385,   1356,   1349,   1370,   1231,  1117 ]
        }
    };

    function getMonthlyBudget(hotelName = 'Guadiana', year = 2027, monthNum = 1) {
        const hKey = normalizeHotel(hotelName);
        const yNum = Number(year) || 2027;
        const mIdx = Math.max(0, Math.min(11, (Number(monthNum) || 1) - 1));
        const capacity = (hKey === 'Cumbria') ? 59 : 108;
        const daysInMonth = new Date(yNum, mIdx + 1, 0).getDate();
        const availableRN = daysInMonth * capacity;

        // Comprobar si existe presupuesto personalizado en hotel_manager_db_v2
        let customBudget = null;
        try {
            const rawDb = getStoredItem('hotel_manager_db_v2');
            if (rawDb) {
                const db = JSON.parse(rawDb);
                const customKey = `custom_budget_${yNum}`;
                if (db && db[hKey] && db[hKey][customKey]) {
                    customBudget = db[hKey][customKey];
                }
            }
        } catch (e) {}

        const officialData = (yNum === 2026) ? OFFICIAL_BUDGET_2026[hKey] : OFFICIAL_BUDGET_2027[hKey];
        const isCustomValid = !!(customBudget && Array.isArray(customBudget.rev) && customBudget.rev.length === 12 && customBudget.rev.some(v => v > 0));

        const targetRev = isCustomValid ? Number(customBudget.rev[mIdx]) : Number(officialData.rev[mIdx]);
        const targetAdr = isCustomValid && customBudget.adr ? Number(customBudget.adr[mIdx]) : Number(officialData.adr[mIdx]);
        const targetRN = (officialData.rn && !isCustomValid) 
            ? Number(officialData.rn[mIdx]) 
            : (targetAdr > 0 ? Math.round(targetRev / targetAdr) : 0);
        const targetOccPct = availableRN > 0 ? (targetRN / availableRN) * 100 : 0;

        return {
            hotel: hKey,
            year: yNum,
            monthNum: mIdx + 1,
            monthName: MONTH_NAMES_ES[mIdx],
            daysInMonth,
            capacity,
            availableRN,
            targetRev: Math.round(targetRev),
            targetRN,
            targetAdr: Number(targetAdr.toFixed(2)),
            targetOccPct: Number(targetOccPct.toFixed(2)),
            isCustom: isCustomValid,
            scenario: isCustomValid ? 'Personalizado (Usuario)' : officialData.scenario,
            scenarioNote: officialData.note,
            annualTotals: {
                availableRN: officialData.annualAvailableRN,
                revenue: officialData.annualRevenue,
                rn: officialData.annualRN,
                adr: officialData.annualADR,
                occupancyPct: officialData.annualOccPct
            }
        };
    }

    // =========================================================================
    // 5. HISTÓRICO DE SNAPSHOTS MULTI-HORIZONTE (DEDUPLICACIÓN Y PERSISTENCIA)
    // Esquema compacto optimizado para Firebase Realtime DB y local storage:
    // { d: "YYYY-MM-DD", r: rooms, rev: revenue, bar: barPrice, t: "HH:mm" }
    // Mantiene compatibilidad total con snapshots legacy en lectura.
    // =========================================================================
    function normalizeSnapshotEntry(entry, hotelCapacity = 108) {
        if (!entry || typeof entry !== 'object') return null;
        const d = String(entry.d || entry.captureDate || '').trim();
        if (!d) return null;
        const t = String(entry.t || entry.captureTime || '').trim();
        const captureDateTime = entry.captureDateTime || (t ? `${d} ${t}` : d);

        let timestamp = Number(entry.timestamp);
        if (!timestamp || isNaN(timestamp)) {
            if (t && /^\d{1,2}:\d{2}/.test(t)) {
                const timePart = t.length === 5 ? `${t}:00` : t;
                timestamp = new Date(`${d}T${timePart}`).getTime();
            } else {
                timestamp = new Date(`${d}T12:00:00`).getTime();
            }
            if (isNaN(timestamp)) {
                timestamp = new Date(d).getTime() || Date.now();
            }
        }

        const rooms = Math.round(Number(entry.r !== undefined ? entry.r : entry.rooms) || 0);
        const revenue = Number(entry.rev !== undefined ? entry.rev : entry.revenue) || 0;
        const adr = (rooms > 0 && revenue > 0)
            ? Number((revenue / rooms).toFixed(2))
            : (Number(entry.adr) || 0);
        const publishedBar = Number(entry.bar !== undefined ? entry.bar : (entry.publishedBar || entry.currentPrice)) || null;
        const occupancyPct = entry.occupancyPct !== undefined && !isNaN(entry.occupancyPct)
            ? Number(Number(entry.occupancyPct).toFixed(1))
            : Number(((rooms / hotelCapacity) * 100).toFixed(1));
        const availableRooms = entry.availableRooms !== undefined
            ? Number(entry.availableRooms)
            : Math.max(0, hotelCapacity - rooms);

        return {
            captureDate: d,
            captureTime: t,
            captureDateTime: captureDateTime,
            timestamp: timestamp,
            rooms: rooms,
            revenue: revenue,
            adr: adr,
            publishedBar: publishedBar,
            occupancyPct: occupancyPct,
            availableRooms: availableRooms,
            d: d,
            t: t,
            r: rooms,
            rev: revenue,
            bar: publishedBar
        };
    }

    function compactSnapshotEntry(entry) {
        if (!entry || typeof entry !== 'object') return null;
        const d = String(entry.d || entry.captureDate || '').trim();
        if (!d) return null;
        const r = Math.round(Number(entry.r !== undefined ? entry.r : entry.rooms) || 0);
        const compact = { d, r };

        const rev = Number(entry.rev !== undefined ? entry.rev : entry.revenue) || 0;
        if (rev > 0) compact.rev = Number(rev.toFixed(2));

        const bar = Number(entry.bar !== undefined ? entry.bar : (entry.publishedBar || entry.currentPrice)) || 0;
        if (bar > 0) compact.bar = Math.round(bar);

        const t = String(entry.t || entry.captureTime || '').trim();
        if (t) compact.t = t.slice(0, 8);

        return compact;
    }

    function getSnapshotsDB() {
        const raw = getStoredItem(STORAGE_KEY_SNAPSHOTS);
        const result = { Guadiana: {}, Cumbria: {} };
        if (!raw) return result;

        try {
            const parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object') return result;

            ['Guadiana', 'Cumbria'].forEach(hKey => {
                const hotelObj = parsed[hKey];
                if (!hotelObj || typeof hotelObj !== 'object') return;
                const cap = (hKey === 'Cumbria') ? 59 : 108;

                Object.entries(hotelObj).forEach(([dateISO, list]) => {
                    if (!Array.isArray(list) || list.length === 0) return;
                    const normalizedList = [];
                    for (const item of list) {
                        const norm = normalizeSnapshotEntry(item, cap);
                        if (norm) normalizedList.push(norm);
                    }
                    if (normalizedList.length > 0) {
                        normalizedList.sort((a, b) => a.timestamp - b.timestamp);
                        result[hKey][dateISO] = normalizedList;
                    }
                });
            });
        } catch (e) {
            console.warn('[PricingIntelligence] Error al leer snapshots DB:', e);
        }
        return result;
    }

    function saveSnapshotsDB(db) {
        if (!db || typeof db !== 'object') return false;

        const compactDB = { Guadiana: {}, Cumbria: {} };

        ['Guadiana', 'Cumbria'].forEach(hKey => {
            const hotelObj = db[hKey];
            if (!hotelObj || typeof hotelObj !== 'object') return;

            Object.entries(hotelObj).forEach(([dateISO, list]) => {
                if (!Array.isArray(list) || list.length === 0) return;

                // Agrupar por fecha de captura 'd', consolidando capturas intradiarias en la última
                const dayMap = new Map();
                for (const item of list) {
                    const compact = compactSnapshotEntry(item);
                    if (!compact || !compact.d) continue;
                    dayMap.set(compact.d, compact);
                }

                const compactList = Array.from(dayMap.values());
                compactList.sort((a, b) => (a.d > b.d ? 1 : (a.d < b.d ? -1 : 0)));

                // Límite de retención provisional (90 capturas por fecha de estancia)
                const trimmedList = compactList.length > 90 ? compactList.slice(-90) : compactList;
                if (trimmedList.length > 0) {
                    compactDB[hKey][dateISO] = trimmedList;
                }
            });
        });

        const serialized = JSON.stringify(compactDB);
        const currentRaw = getStoredItem(STORAGE_KEY_SNAPSHOTS);

        // Idempotencia: evitar escrituras idénticas y prevenir eventos de sincronización en Firebase
        if (currentRaw === serialized) {
            return true;
        }

        return setStoredItem(STORAGE_KEY_SNAPSHOTS, serialized);
    }

    function recordDailySnapshot(hotelName, dateISO, metrics, captureDate = new Date()) {
        if (!hotelName || !dateISO || !metrics) return false;
        const hKey = normalizeHotel(hotelName);
        const db = getSnapshotsDB();
        db[hKey] = db[hKey] || {};
        db[hKey][dateISO] = db[hKey][dateISO] || [];

        const capDt = (captureDate instanceof Date) ? captureDate : new Date(captureDate);
        let captureDayKey = '';
        let captureTimeKey = '';
        try {
            captureDayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(capDt);
            captureTimeKey = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(capDt);
        } catch (e) {
            captureDayKey = capDt.toISOString().slice(0, 10);
            captureTimeKey = capDt.toTimeString().slice(0, 8);
        }
        const capacity = (hKey === 'Cumbria') ? 59 : 108;
        const rooms = Math.round(Number(metrics.rooms) || 0);
        const revenue = Number(metrics.revenue) || 0;
        const pubBar = Number(metrics.publishedBar || metrics.currentPrice || 0) || null;

        const list = db[hKey][dateISO];
        const existingIdx = list.findIndex(item => (item.d === captureDayKey || item.captureDate === captureDayKey));

        if (existingIdx >= 0) {
            const existing = list[existingIdx];
            if (existing.rooms === rooms && existing.revenue === revenue && (existing.publishedBar || null) === pubBar) {
                return true; // Sin cambios, no-op idempotente
            }
            existing.rooms = rooms;
            existing.r = rooms;
            existing.revenue = revenue;
            existing.rev = revenue;
            existing.adr = (rooms > 0 && revenue > 0) ? Number((revenue / rooms).toFixed(2)) : (Number(metrics.adr) || 0);
            existing.publishedBar = pubBar;
            existing.bar = pubBar;
            existing.captureTime = captureTimeKey;
            existing.t = captureTimeKey;
            existing.captureDateTime = `${captureDayKey} ${captureTimeKey}`;
            existing.occupancyPct = Number(((rooms / capacity) * 100).toFixed(1));
            existing.availableRooms = Math.max(0, capacity - rooms);
        } else {
            const entry = normalizeSnapshotEntry({
                d: captureDayKey,
                t: captureTimeKey,
                r: rooms,
                rev: revenue,
                bar: pubBar
            }, capacity);
            list.push(entry);
        }

        return saveSnapshotsDB(db);
    }

    function captureBatchSnapshots(hotelName, dailyMap, captureDate = new Date()) {
        if (!hotelName || !dailyMap || typeof dailyMap !== 'object') return 0;
        const hKey = normalizeHotel(hotelName);
        const db = getSnapshotsDB();
        db[hKey] = db[hKey] || {};

        const capDt = (captureDate instanceof Date) ? captureDate : new Date(captureDate);
        let captureDayKey = '';
        let captureTimeKey = '';
        try {
            captureDayKey = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Madrid' }).format(capDt);
            captureTimeKey = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(capDt);
        } catch (e) {
            captureDayKey = capDt.toISOString().slice(0, 10);
            captureTimeKey = capDt.toTimeString().slice(0, 8);
        }
        const capacity = (hKey === 'Cumbria') ? 59 : 108;

        let count = 0;
        let hasAnyChange = false;

        Object.entries(dailyMap).forEach(([iso, val]) => {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
            const rooms = Math.round(typeof val === 'object' ? (val.rooms ?? val.otbRooms ?? 0) : Number(val) || 0);
            const revenue = typeof val === 'object' ? (val.revenue ?? 0) : 0;
            const pubBar = typeof val === 'object' ? (val.price ?? val.bar ?? 0) : 0;

            db[hKey][iso] = db[hKey][iso] || [];
            const list = db[hKey][iso];
            const existingIdx = list.findIndex(item => (item.d === captureDayKey || item.captureDate === captureDayKey));

            if (existingIdx >= 0) {
                const existing = list[existingIdx];
                const existingRooms = existing.rooms !== undefined ? existing.rooms : existing.r;
                const existingRev = existing.revenue !== undefined ? existing.revenue : (existing.rev || 0);
                const existingBar = existing.publishedBar !== undefined ? existing.publishedBar : (existing.bar || 0);

                if (existingRooms !== rooms || existingRev !== revenue || (existingBar || 0) !== (pubBar || 0)) {
                    existing.rooms = rooms;
                    existing.r = rooms;
                    existing.revenue = revenue;
                    existing.rev = revenue;
                    existing.adr = (rooms > 0 && revenue > 0) ? Number((revenue / rooms).toFixed(2)) : (typeof val === 'object' ? (val.adr || 0) : 0);
                    existing.publishedBar = pubBar || null;
                    existing.bar = pubBar || null;
                    existing.t = captureTimeKey;
                    existing.captureTime = captureTimeKey;
                    existing.captureDateTime = `${captureDayKey} ${captureTimeKey}`;
                    existing.occupancyPct = Number(((rooms / capacity) * 100).toFixed(1));
                    existing.availableRooms = Math.max(0, capacity - rooms);
                    hasAnyChange = true;
                }
            } else {
                const entry = normalizeSnapshotEntry({
                    d: captureDayKey,
                    t: captureTimeKey,
                    r: rooms,
                    rev: revenue,
                    bar: pubBar || null
                }, capacity);
                list.push(entry);
                hasAnyChange = true;
            }
            count++;
        });

        if (hasAnyChange) {
            saveSnapshotsDB(db);
        }
        return count;
    }

    function calculateDailyPickup(hotelName, dateISO, currentMetrics = null, referenceDate = new Date()) {
        const hKey = normalizeHotel(hotelName);
        const result = {
            dateISO: dateISO,
            current: { rooms: 0, revenue: 0, adr: 0, occPct: 0 },
            h24h: { available: false, diffRooms: null, diffRev: null, diffAdr: null, adrPickup: null, diffOccPct: null, label: 'Sin datos', status: 'NO_DATA' },
            d3:   { available: false, diffRooms: null, diffRev: null, diffAdr: null, adrPickup: null, diffOccPct: null, label: 'Sin datos', status: 'NO_DATA' },
            d7:   { available: false, diffRooms: null, diffRev: null, diffAdr: null, adrPickup: null, diffOccPct: null, label: 'Sin datos', status: 'NO_DATA' },
            d14:  { available: false, diffRooms: null, diffRev: null, diffAdr: null, adrPickup: null, diffOccPct: null, label: 'Sin datos', status: 'NO_DATA' },
            d30:  { available: false, diffRooms: null, diffRev: null, diffAdr: null, adrPickup: null, diffOccPct: null, label: 'Sin datos', status: 'NO_DATA' },
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
                const status = instantPickup > 0 ? 'GROWTH' : (instantPickup < 0 ? 'CANCELLATION' : 'STABLE');
                const label = instantPickup === 0 
                    ? '0 RN' 
                    : (instantPickup > 0 ? `+${instantPickup} RN` : `${instantPickup} RN (Cancelaciones: ${Math.abs(instantPickup)} habs)`);
                result.h24h = {
                    available: true,
                    diffRooms: instantPickup,
                    diffRev: 0,
                    diffAdr: 0,
                    adrPickup: 0,
                    diffOccPct: 0,
                    baselineRooms: current.rooms - instantPickup,
                    baselineDate: 'Última carga',
                    label: label,
                    status: status
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
                const prevAdr = (bestMatch.rooms > 0 && bestMatch.revenue > 0) ? (bestMatch.revenue / bestMatch.rooms) : (bestMatch.adr || 0);
                const diffAdr = (current.adr > 0 && prevAdr > 0) ? Number((current.adr - prevAdr).toFixed(2)) : 0;
                const adrPickup = (diffRooms !== 0 && diffRev !== 0) ? Number((diffRev / diffRooms).toFixed(2)) : 0;
                const diffOccPct = current.occupancyPct - bestMatch.occupancyPct;

                const status = diffRooms > 0 ? 'GROWTH' : (diffRooms < 0 ? 'CANCELLATION' : 'STABLE');
                const label = diffRooms === 0 
                    ? '0 RN' 
                    : (diffRooms > 0 ? `+${diffRooms} RN` : `${diffRooms} RN (Cancelaciones: ${Math.abs(diffRooms)} habs)`);

                result[h.key] = {
                    available: true,
                    diffRooms: diffRooms,
                    diffRev: diffRev,
                    diffAdr: diffAdr,
                    adrPickup: adrPickup,
                    diffOccPct: diffOccPct,
                    baselineRooms: bestMatch.rooms,
                    baselineDate: bestMatch.captureDate,
                    baselineTime: bestMatch.captureTime || '',
                    label: label,
                    status: status
                };
            } else if (h.key === 'h24h' && instantPickup !== null) {
                const status = instantPickup > 0 ? 'GROWTH' : (instantPickup < 0 ? 'CANCELLATION' : 'STABLE');
                const label = instantPickup === 0 
                    ? '0 RN' 
                    : (instantPickup > 0 ? `+${instantPickup} RN` : `${instantPickup} RN (Cancelaciones: ${Math.abs(instantPickup)} habs)`);
                result.h24h = {
                    available: true,
                    diffRooms: instantPickup,
                    diffRev: 0,
                    diffAdr: 0,
                    adrPickup: 0,
                    diffOccPct: 0,
                    baselineRooms: current.rooms - instantPickup,
                    baselineDate: 'Última carga',
                    label: label,
                    status: status
                };
            } else {
                result[h.key] = {
                    available: false,
                    diffRooms: null,
                    diffRev: null,
                    diffAdr: null,
                    adrPickup: null,
                    diffOccPct: null,
                    label: 'Sin datos',
                    status: 'NO_DATA'
                };
            }
        });

        return result;
    }

    // =========================================================================
    // 6. MOTOR DE RECOMENDACIÓN DIARIA INTELIGENTE (MULTI-HOTEL UNIFICADO)
    // Sercotel Guadiana (108 habitaciones) y Cumbria Spa & Hotel (59 habitaciones)
    // Orden de evaluación estricto en 9 pasos (Fases 1 a 5)
    // =========================================================================

    /**
     * Helper Fase 3: Análisis cuantitativo y cualitativo de pick-up.
     * Diferencia bruto, cancelaciones, neto 24h, 7d, 14d, 30d, ritmo esperado según antelación y escala,
     * y presión de absorción sobre inventario restante.
     */
    function evaluatePickupPace({ pickupData, otbChange, grossPickup, cancellations, netPickup, daysOut, capacity, availableRooms }) {
        const instantPickup = (otbChange !== undefined && otbChange !== null) ? Number(otbChange) : null;
        const gross = (grossPickup !== undefined && grossPickup !== null) ? Number(grossPickup) : null;
        const cancel = (cancellations !== undefined && cancellations !== null) ? Number(cancellations) : null;
        
        let net = (netPickup !== undefined && netPickup !== null) ? Number(netPickup) : null;
        if (net === null && gross !== null && cancel !== null) {
            net = gross - cancel;
        }

        const p24h = (pickupData?.h24h?.available) ? pickupData.h24h.diffRooms : (net !== null ? net : (instantPickup || 0));
        const p7d = (pickupData?.d7?.available) ? pickupData.d7.diffRooms : (net !== null ? net : (instantPickup || 0));
        const p14d = (pickupData?.d14?.available) ? pickupData.d14.diffRooms : null;
        const p30d = (pickupData?.d30?.available) ? pickupData.d30.diffRooms : null;

        const bestPickup = Math.max(p24h || 0, p7d || 0, net || 0, instantPickup || 0);

        // Histórico suficiente: existen snapshots registrados o comparativas explícitas
        const hasSufficientHistory = !!(
            (pickupData && (pickupData.h24h?.available || pickupData.d7?.available || (pickupData.snapshotsCount && pickupData.snapshotsCount >= 2))) ||
            (otbChange !== undefined && otbChange !== null) ||
            (gross !== null && cancel !== null)
        );

        const hotelScale = capacity / 100; // Normalización por tamaño del establecimiento (1.08 Guadiana, 0.59 Cumbria)
        let referenceVelocity = 1.0 * hotelScale;
        if (daysOut > 60) {
            referenceVelocity = 0.8 * hotelScale;
        } else if (daysOut > 30) {
            referenceVelocity = 1.4 * hotelScale;
        } else if (daysOut > 14) {
            referenceVelocity = 2.0 * hotelScale;
        } else if (daysOut > 7) {
            referenceVelocity = 2.4 * hotelScale;
        } else {
            referenceVelocity = 1.5 * hotelScale;
        }

        const pickupPressure = (availableRooms > 0) ? (bestPickup / availableRooms) : 0;

        const isFavorable = (bestPickup > 0) && (
            (bestPickup >= referenceVelocity) ||
            (pickupPressure >= 0.12 && bestPickup >= 1)
        );

        const isWeak = hasSufficientHistory && (
            (bestPickup <= 0) || (daysOut <= 30 && bestPickup < (referenceVelocity * 0.5))
        );

        return {
            gross,
            cancellations: cancel,
            net: net !== null ? net : bestPickup,
            p24h,
            p7d,
            p14d,
            p30d,
            bestPickup,
            pickupPressure,
            referenceVelocity,
            expectedVelocity: referenceVelocity, // Retrocompatibilidad
            isFavorable,
            isWeak,
            hasSufficientHistory
        };
    }

    /**
     * Helper Fase 4: Estimación de ocupación confirmada vs prevista.
     * Nunca confunde ocupación estadística con confirmada PMS.
     */
    function evaluateOccupancyForecast({ otbRooms, capacity, daysOut, projectedOccupancyPct, pickupMetrics }) {
        const confirmedRooms = Math.min(capacity, Math.max(0, Math.round(Number(otbRooms) || 0)));
        const confirmedOccPct = (capacity > 0) ? ((confirmedRooms / capacity) * 100) : 0;
        const availableRooms = Math.max(0, capacity - confirmedRooms);

        const hasManualForecast = (projectedOccupancyPct !== null && projectedOccupancyPct !== undefined && !isNaN(projectedOccupancyPct));
        
        let projectedOccPct = confirmedOccPct;
        let projectedRooms = confirmedRooms;
        let isForecastReliable = false;
        let forecastMethod = 'CONFIRMED_OTB';
        let forecastNote = '';
        let forecastStatus = 'Previsión no disponible';

        if (hasManualForecast) {
            projectedOccPct = Math.min(100, Math.max(0, Number(projectedOccupancyPct)));
            projectedRooms = Math.round((projectedOccPct / 100) * capacity);
            isForecastReliable = true;
            forecastMethod = 'PARAM_PROJECTED';
            forecastNote = `Ocupación final prevista informada: ${projectedOccPct.toFixed(0)}% (${projectedRooms} habs)`;
            forecastStatus = `${projectedOccPct.toFixed(0)}% (${projectedRooms} habs)`;
        } else if (pickupMetrics?.hasSufficientHistory && daysOut > 0 && daysOut <= 60 && pickupMetrics.bestPickup > 0) {
            const remainingPaceDaily = Math.min(2.0, (pickupMetrics.bestPickup / (pickupMetrics.p7d ? 7 : 1)));
            const estimatedRemainingRooms = Math.round(remainingPaceDaily * Math.min(daysOut, 14) * 0.7);
            const estFinalRooms = Math.min(capacity, confirmedRooms + estimatedRemainingRooms);
            projectedOccPct = (estFinalRooms / capacity) * 100;
            projectedRooms = estFinalRooms;
            isForecastReliable = true;
            forecastMethod = 'PACE_EXTRAPOLATION';
            forecastNote = `Estimación estadística inicial: ${projectedOccPct.toFixed(0)}% (OTB ${confirmedRooms} + ${estimatedRemainingRooms} proyectadas)`;
            forecastStatus = `${projectedOccPct.toFixed(0)}% (${projectedRooms} habs)`;
        } else {
            isForecastReliable = false;
            forecastMethod = 'CONFIRMED_OTB_FALLBACK';
            forecastNote = 'Sin histórico estadístico suficiente para curva de pickup. Se utiliza ocupación confirmada PMS.';
            forecastStatus = 'Previsión no disponible';
        }

        const effectiveOcc = (isForecastReliable && projectedOccPct > confirmedOccPct) ? projectedOccPct : confirmedOccPct;

        return {
            confirmedRooms,
            confirmedOccPct,
            availableRooms,
            projectedRooms,
            projectedOccPct,
            effectiveOcc,
            isForecastReliable,
            forecastMethod,
            forecastNote,
            forecastStatus
        };
    }

    function evaluateDailyRecommendation(params) {
        // === PASO 1: VALIDEZ Y ACTUALIZACIÓN DE LOS DATOS ===
        if (!params || typeof params !== 'object') {
            return {
                action: 'MANTENER',
                proposedPrice: 64,
                triggerText: 'DATOS INVÁLIDOS',
                reasons: ['Parámetros de recomendación no proporcionados o inválidos.'],
                confidenceScore: 'Baja'
            };
        }

        const hotelName = normalizeHotel(params.hotelName || 'Guadiana');
        const capacity = Number(params.capacity) || (hotelName === 'Cumbria' ? 59 : 108);
        const dateISO = params.dateISO;
        const currentPrice = Number(params.currentPrice) || 0;
        const marketAvg = Number(params.marketAvg) || 0;
        const lowestCompPrice = Number(params.lowestCompPrice) || 0;
        const highestCompPrice = Number(params.highestCompPrice) || 0;
        const soldCompsCount = Number(params.soldCompsCount) || 0;
        const customEvent = params.customEvent || null;
        const pickupData = params.pickupData || null;

        // Parseo seguro de fecha y cálculo de antelación (días hasta llegada)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let daysOut = 999;
        let monthNum = 1;
        let yearNum = 2027;
        let dow = 1;

        if (dateISO && dateISO.includes('-')) {
            const parts = dateISO.split('-');
            if (parts.length === 3) {
                yearNum = parseInt(parts[0], 10);
                monthNum = parseInt(parts[1], 10);
                const dy = parseInt(parts[2], 10);
                const targetDt = new Date(yearNum, monthNum - 1, dy);
                dow = targetDt.getDay();
                daysOut = Math.ceil((targetDt.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            }
        }

        // Selección rigurosa de BAR base según Hotel, Año, Mes y DOW (o excepción aprobada)
        const baseInfo = getBaseBarForDate(dateISO, hotelName);
        let baseBar = (customEvent && customEvent.barBase > 0) ? customEvent.barBase : baseInfo.bar;
        const isException = baseInfo.isException || !!(customEvent && (customEvent.barBase > 0 || customEvent.name));
        const eventName = customEvent?.name || baseInfo.eventName || '';

        // BAR VIGENTE (precio publicado actualmente; fallback a base si no está cargado)
        const barVigente = (currentPrice > 0) ? Math.round(currentPrice) : baseBar;

        // === PASO 4: OCUPACIÓN CONFIRMADA Y PREVISTA ===
        const tempAvail = Math.max(0, capacity - Math.round(Number(params.otbRooms) || 0));
        const pickupMetrics = evaluatePickupPace({
            pickupData,
            otbChange: params.otbChange,
            grossPickup: params.grossPickup,
            cancellations: params.cancellations,
            netPickup: params.netPickup,
            daysOut,
            capacity,
            availableRooms: tempAvail
        });

        const occData = evaluateOccupancyForecast({
            otbRooms: params.otbRooms,
            capacity,
            daysOut,
            projectedOccupancyPct: params.projectedOccupancyPct,
            pickupMetrics
        });

        const confirmedRooms = occData.confirmedRooms;
        const confirmedOccPct = occData.confirmedOccPct;
        const availableRooms = occData.availableRooms;
        const effectiveOcc = occData.effectiveOcc;

        // === PASO 2: DISPONIBILIDAD REAL DE INVENTARIO ===
        if (effectiveOcc >= 100 || availableRooms <= 0 || confirmedRooms >= capacity) {
            return {
                dateISO,
                hotelName,
                year: yearNum,
                action: 'REVISIÓN MANUAL',
                baseBar,
                barVigente,
                barObjetivo: baseBar,
                currentPrice: barVigente,
                proposedPrice: barVigente,
                minFloorPrice: baseBar,
                diffAmount: 0,
                diffPct: 0,
                daysOut,
                reasons: [
                    `Hotel al 100% de ocupación confirmada (${confirmedRooms}/${capacity} habitaciones vendidas).`,
                    `Inventario agotado: cerrar ventas en canales y bloquear subidas o promociones automáticas sin disponibilidad real.`
                ],
                fullReasonText: `Hotel al 100% de ocupación (${confirmedRooms}/${capacity} habs). Inventario agotado: cerrar ventas.`,
                confidenceScore: 'Muy Alta',
                riskAssessment: 'Riesgo crítico de sobreventa.',
                isException,
                eventName,
                triggerText: '100% LLENO',
                demandStatus: 'INVENTARIO AGOTADO',
                isCommerciallyOptimal: true,
                hasSufficientPickupHistory: pickupMetrics.hasSufficientHistory,
                pickupMetrics,
                occupancyData: occData,
                minRange: baseBar,
                maxRange: barVigente,
                rangeText: `${barVigente} € (Lleno)`,
                rangeCalculation: `Capacidad completada (${confirmedRooms}/${capacity} habs)`,
                mathToleranceBand: {
                    min: Math.round(barVigente * 0.95),
                    max: Math.round(barVigente * 1.05),
                    text: `${Math.round(barVigente * 0.95)} € – ${Math.round(barVigente * 1.05)} €`
                }
            };
        }

        // === PASO 3: TARIFAS ESPECIALES Y EXCEPCIONES ===
        if (isException || customEvent) {
            const act = (barVigente < baseBar) ? 'SUBIR' : 'MANTENER';
            const prop = Math.max(barVigente, baseBar);
            const reasons = [
                `Fecha especial con excepción comercial aprobada (${eventName || 'Evento Especial'}).`,
                `Tarifa base de evento fijada: ${baseBar} €. Se respeta prioritariamente sin aplicar segundo incremento ordinario.`
            ];
            if (barVigente < baseBar) {
                reasons.push(`Tarifa vigente (${barVigente} €) inferior a la tarifa excepcional fijada. Alinear a ${baseBar} €.`);
            } else {
                reasons.push(`Tarifa vigente (${barVigente} €) respeta o supera la condición excepcional fijada.`);
            }

            return {
                dateISO,
                hotelName,
                year: yearNum,
                action: act,
                baseBar,
                barVigente,
                barObjetivo: baseBar,
                currentPrice: barVigente,
                proposedPrice: prop,
                minFloorPrice: baseBar,
                diffAmount: prop - barVigente,
                diffPct: barVigente > 0 ? (((prop - barVigente) / barVigente) * 100) : 0,
                daysOut,
                reasons,
                fullReasonText: reasons.join(' '),
                confidenceScore: 'Muy Alta',
                riskAssessment: 'Riesgo bajo (evento controlado)',
                isException: true,
                eventName,
                triggerText: act === 'SUBIR' ? `🎪 Alinear a Evento (${baseBar}€)` : '🎪 Evento Especial',
                demandStatus: 'FECHA CON EVENTO',
                isCommerciallyOptimal: true,
                hasSufficientPickupHistory: pickupMetrics.hasSufficientHistory,
                pickupMetrics,
                occupancyData: occData,
                minRange: baseBar,
                maxRange: Math.max(baseBar, prop),
                rangeText: `${baseBar} € – ${Math.max(baseBar, prop)} €`,
                rangeCalculation: `Tarifa de evento fijada: ${baseBar} €`,
                mathToleranceBand: {
                    min: Math.round(barVigente * 0.95),
                    max: Math.round(barVigente * 1.05),
                    text: `${Math.round(barVigente * 0.95)} € – ${Math.round(barVigente * 1.05)} €`
                }
            };
        }

        // === PASO 5: PICKUP Y ANTELACIÓN ===
        // Obtenidos en pickupMetrics (bestPickup, isFavorable, isWeak, pickupPressure, etc.)

        // === PASO 6: BAR OBJETIVO SEGÚN ESCALADO ===
        // Tramos comerciales acordados sobre la BAR base (no acumulativos):
        // 0–50%: 0% | 51–60%: +5% | 61–70%: +13% | 71–80%: +21% | 81–90%: +37% | 91–95%: +53% | >95%: +77%
        let incPct = 0;
        let tierLabel = '0–50%';
        const occTierCheck = Math.round(effectiveOcc);

        if (occTierCheck > 95) {
            incPct = 77;
            tierLabel = '>95%';
        } else if (occTierCheck >= 91) {
            incPct = 53;
            tierLabel = '91–95%';
        } else if (occTierCheck >= 81) {
            incPct = 37;
            tierLabel = '81–90%';
        } else if (occTierCheck >= 71) {
            incPct = 21;
            tierLabel = '71–80%';
        } else if (occTierCheck >= 61) {
            incPct = 13;
            tierLabel = '61–70%';
        } else if (occTierCheck >= 51) {
            incPct = 5;
            tierLabel = '51–60%';
        } else {
            incPct = 0;
            tierLabel = '0–50%';
        }

        const barObjetivo = Math.round(baseBar * (1 + incPct / 100));

        // === PASO 7: BAR VIGENTE (Evaluación de precios frente a base y objetivo) ===
        // === PASO 8: COMPETENCIA Y CONTEXTO DE MERCADO ===
        let action = 'MANTENER';
        let proposedPrice = barVigente;
        let triggerText = 'MANTENER';
        let demandStatus = 'EN RANGO';
        let reasons = [];
        let isCommerciallyOptimal = true;
        let confidenceScore = pickupMetrics.hasSufficientHistory ? 'Alta' : 'Media';
        let riskAssessment = 'Riesgo bajo';

        const confidenceDetails = {
            pms: 'Alta (100% certificado por carga PMS)',
            expedia: (soldCompsCount > 0) 
                ? 'Media (alerta: competidores sin tarifas observadas no certifican lleno)' 
                : 'Alta (tarifas públicas observables)',
            revenue: pickupMetrics.hasSufficientHistory ? 'Alta' : 'Prudencial (sin histórico de pickup)'
        };

        if (!pickupMetrics.hasSufficientHistory) {
            reasons.push('Información histórica insuficiente de pickup: ritmo evaluado con baremo de referencia por tamaño (' + capacity + ' habs) y antelación (' + daysOut + 'd), no sobre histórico confirmado.');
        } else {
            reasons.push(`Histórico de pickup contrastado (+${pickupMetrics.bestPickup} RN recientes confirmadas en snapshots).`);
        }
        if (occData.isForecastReliable) {
            reasons.push(occData.forecastNote);
        } else {
            reasons.push('Previsión de demanda: No disponible por falta de histórico de pickup suficiente. Se opera con OTB confirmado.');
        }

        // --- Contexto de Competencia Observable (Expedia / OTA) ---
        // Expedia proporciona precios y disponibilidad comercial observable, no la ocupación real ni habitaciones vendidas
        if (soldCompsCount > 0) {
            reasons.push(`Mercado OTA (Expedia): ${soldCompsCount} competidor(es) sin tarifa pública observable. Hipótesis comercial: canal cerrado o inventario pendiente de carga (no certifica ocupación al 100% ni habitaciones vendidas).`);
        }
        if (marketAvg > 0) {
            reasons.push(`Estadística de mercado calculada exclusivamente sobre tarifas observadas válidas (media: ${Math.round(marketAvg)} €).`);
        } else if (soldCompsCount > 0) {
            reasons.push('Sin tarifas observables en el set competitivo de Expedia. Referencia de mercado no disponible.');
        }

        // --- SUB-CASO A: BAR VIGENTE INFERIOR A BAR BASE (Suelo inviolable) ---
        if (barVigente < baseBar) {
            action = 'SUBIR';
            proposedPrice = baseBar;
            triggerText = `Alinear a Base (${baseBar}€)`;
            demandStatus = 'POR DEBAJO DE BAR BASE';
            isCommerciallyOptimal = false;
            reasons.push(`Tarifa vigente (${barVigente} €) por debajo de la BAR base oficial de la fecha (${baseBar} €).`);
            reasons.push(`Alinear tarifa a la BAR base (${baseBar} €); no se admiten descuentos automáticos que perforen el suelo.`);
        }
        // --- SUB-CASO B: OCUPACIÓN DEL 0 % AL 50 % ---
        else if (occTierCheck <= 50) {
            // Paso 8: Competitividad en ocupación baja (bloqueo estricto de bajada automática, alertando a revisión manual)
            const hasCompRisk = (marketAvg > 0 && barVigente > (marketAvg * 1.25) && pickupMetrics.isWeak && daysOut <= 45);

            if (hasCompRisk) {
                action = 'REVISIÓN MANUAL';
                proposedPrice = barVigente; // NUNCA proponer bajada automática
                triggerText = '⚠️ REVISAR TARIFA (Competitividad)';
                demandStatus = 'REVISAR COMPETITIVIDAD';
                isCommerciallyOptimal = false;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 0–50%). Tarifa vigente (${barVigente} €) un ${Math.round(((barVigente - marketAvg) / marketAvg) * 100)}% por encima de la media de mercado (${marketAvg} €).`);
                reasons.push(`Pick-up débil o nulo con antelación de ${daysOut} días. Posible pérdida de competitividad en captación.`);
                reasons.push(`Bajadas automáticas bloqueadas: MANTENER tarifa en ${barVigente} € y someter a REVISIÓN COMERCIAL para valorar promociones segmentadas antes de alterar la tarifa pública.`);
            } else if (daysOut >= 0 && daysOut <= 7 && pickupMetrics.isWeak) {
                action = 'REVISIÓN MANUAL';
                proposedPrice = barVigente;
                triggerText = 'REVISAR (Última Hora)';
                demandStatus = 'REVISAR PROMOCIÓN';
                reasons.push(`Antelación corta (${daysOut} días) con pick-up débil. Valorar promoción segmentada antes de reducir tarifa pública.`);
            } else if (barVigente > barObjetivo) {
                // Tarifa vigente superior a objetivo con ocupación baja: PROTEGER TARIFA VIGENTE
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = (effectiveOcc >= 41) ? 'MANTENER / VIGILAR' : ((pickupMetrics.bestPickup > 0) ? `⚡ Vigilar (+${pickupMetrics.bestPickup})` : 'MANTENER');
                demandStatus = 'TARIFA VIGENTE PROTEGIDA';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 0–50%). BAR base: ${baseBar} €. BAR objetivo: ${barObjetivo} €. Tarifa vigente: ${barVigente} €.`);
                reasons.push(`La BAR vigente (${barVigente} €) supera la BAR objetivo. Regla de protección: MANTENER la tarifa vigente (${barVigente} €) y no recomendar bajada automática.`);
                if (pickupMetrics.bestPickup > 0) {
                    reasons.push(`Pick-up de +${pickupMetrics.bestPickup} RN actúa como indicador de vigilancia favorable sin provocar subida adicional con ocupación baja.`);
                }
            } else {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = (effectiveOcc >= 41) ? 'MANTENER / VIGILAR' : ((pickupMetrics.bestPickup > 0) ? `⚡ Vigilar (+${pickupMetrics.bestPickup})` : 'MANTENER');
                demandStatus = 'MANTENER EN BASE';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 0–50%). BAR base: ${baseBar} €.`);
                reasons.push(`Decisión ordinaria: MANTENER tarifa vigente (${barVigente} €) para captación de volumen base.`);
                if (pickupMetrics.bestPickup > 0) {
                    reasons.push(`Pick-up favorable (+${pickupMetrics.bestPickup} RN) confirma tracción comercial adecuada.`);
                }
            }
        }
        // --- SUB-CASO C: OCUPACIÓN DEL 51 % AL 60 % (Condicionada a pickup y demanda favorables) ---
        else if (occTierCheck <= 60) {
            if (pickupMetrics.isFavorable) {
                if (barVigente < barObjetivo) {
                    action = 'SUBIR';
                    proposedPrice = barObjetivo;
                    triggerText = `📈 Evaluar +5% (${barObjetivo}€)`;
                    demandStatus = 'SUBIDA CONDICIONADA +5%';
                    reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 51–60%).`);
                    reasons.push(`Primera subida condicional (+5% sobre BAR base ${baseBar} € = ${barObjetivo} €) justificada por pick-up favorable (+${pickupMetrics.bestPickup} RN) y antelación de ${daysOut} días.`);
                } else {
                    action = 'MANTENER';
                    proposedPrice = barVigente;
                    triggerText = `MANTENER (${barVigente}€)`;
                    demandStatus = 'OBJETIVO +5% CUBIERTO';
                    isCommerciallyOptimal = true;
                    reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 51–60%). Tarifa vigente (${barVigente} €) ya cubre la BAR objetivo (+5%: ${barObjetivo} €). MANTENER.`);
                }
            } else {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = 'MANTENER (Vigilar Demanda)';
                demandStatus = 'REVISAR PICKUP';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo 51–60%), pero ritmo de pick-up débil (${pickupMetrics.bestPickup <= 0 ? '0 RN' : '+' + pickupMetrics.bestPickup + ' RN'}).`);
                reasons.push(`No efectuar subida al 5% sin demanda favorable confirmada. MANTENER tarifa vigente (${barVigente} €) y revisar evolución.`);
            }
        }
        // --- SUB-CASO D: OCUPACIÓN DEL 61 % AL 80 % (Escalado orientativo 13% o 21%) ---
        else if (occTierCheck <= 80) {
            if (pickupMetrics.isWeak && daysOut > 14) {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = 'MANTENER (Demanda Débil)';
                demandStatus = 'REVISAR DEMANDA';
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo ${tierLabel}), pero pick-up débil. MANTENER tarifa vigente (${barVigente} €) y revisar demanda.`);
            } else if (barVigente < barObjetivo) {
                action = 'SUBIR';
                proposedPrice = barObjetivo;
                triggerText = `📈 Evaluar +${incPct}% (${barObjetivo}€)`;
                demandStatus = `SUBIDA ORIENTATIVA +${incPct}%`;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo ${tierLabel}).`);
                reasons.push(`Escalado orientativo (+${incPct}% sobre BAR base ${baseBar} € = ${barObjetivo} €) con demanda favorable. Tarifa vigente (${barVigente} €) inferior al objetivo.`);
            } else {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = `MANTENER (${barVigente}€)`;
                demandStatus = 'OBJETIVO CUBIERTO';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación en ${effectiveOcc.toFixed(0)}% (tramo ${tierLabel}). Tarifa vigente (${barVigente} €) ya iguala o supera la BAR objetivo (+${incPct}%: ${barObjetivo} €). MANTENER.`);
            }
        }
        // --- SUB-CASO E: OCUPACIÓN DEL 81 % AL 95 % (Proteger inventario / limitar descuentos) ---
        else if (occTierCheck <= 95) {
            if (barVigente < barObjetivo) {
                if (pickupMetrics.isFavorable || daysOut <= 14) {
                    action = 'SUBIR';
                    proposedPrice = barObjetivo;
                    triggerText = (effectiveOcc <= 90) ? `🔒 Proteger +${incPct}% (${barObjetivo}€)` : `🔒 Limitar Desc. +${incPct}% (${barObjetivo}€)`;
                    demandStatus = (effectiveOcc <= 90) ? 'PROTEGER INVENTARIO' : 'LIMITAR DESCUENTOS';
                    reasons.push(`Alta ocupación en ${effectiveOcc.toFixed(0)}% (tramo ${tierLabel} · ${availableRooms} habs libres).`);
                    reasons.push(`Demanda confirmada. Objetivo de escalado (+${incPct}% sobre BAR base ${baseBar} € = ${barObjetivo} €). Tarifa vigente (${barVigente} €) inferior al objetivo.`);
                } else {
                    action = 'MANTENER';
                    proposedPrice = barVigente;
                    triggerText = `🔒 MANTENER (Evaluar ${barObjetivo}€)`;
                    demandStatus = 'EVALUAR SUBIDA A OBJETIVO';
                    isCommerciallyOptimal = true;
                    reasons.push(`Alta ocupación en ${effectiveOcc.toFixed(0)}% (${availableRooms} habs libres · tramo ${tierLabel}). BAR base: ${baseBar} €. BAR objetivo: ${barObjetivo} € (+${incPct}%).`);
                    reasons.push(`Tarifa vigente (${barVigente} €) en tramo alto. Pick-up reciente estable (+${pickupMetrics.bestPickup} RN). MANTENER ${barVigente} €; evaluar subida a ${barObjetivo} € cuando la demanda restante la justifique.`);
                }
            } else {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = `🔒 MANTENER (${barVigente}€)`;
                demandStatus = 'INVENTARIO PROTEGIDO';
                isCommerciallyOptimal = true;
                reasons.push(`Alta ocupación en ${effectiveOcc.toFixed(0)}% (tramo ${tierLabel}). Tarifa vigente (${barVigente} €) cubre la BAR objetivo (${barObjetivo} €).`);
            }
            reasons.push('Revisar y limitar tarifas promocionales, descuentos y canales de menor rentabilidad.');
        }
        // --- SUB-CASO F: OCUPACIÓN MÁS DEL 95 % Y MENOS DEL 100 % (Maximizar ingresos +77%) ---
        else {
            if (barVigente < barObjetivo) {
                if (pickupMetrics.isFavorable || daysOut <= 21) {
                    action = 'SUBIR';
                    proposedPrice = barObjetivo;
                    triggerText = `🔥 Max. Ingresos +77% (${barObjetivo}€)`;
                    demandStatus = 'MAXIMIZAR INGRESOS';
                    reasons.push(`Ocupación crítica (${effectiveOcc.toFixed(0)}% · ${availableRooms} habs libres).`);
                    reasons.push(`Objetivo pico (+77% sobre BAR base ${baseBar} € = ${barObjetivo} €) en las últimas plazas.`);
                } else {
                    action = 'MANTENER';
                    proposedPrice = barVigente;
                    triggerText = `🔥 MANTENER (Evaluar ${barObjetivo}€)`;
                    demandStatus = 'EVALUAR SUBIDA A PICO';
                    isCommerciallyOptimal = true;
                    reasons.push(`Ocupación crítica (${effectiveOcc.toFixed(0)}% · ${availableRooms} habs libres). BAR base: ${baseBar} €. BAR objetivo: ${barObjetivo} € (+77%).`);
                    reasons.push(`Tarifa vigente (${barVigente} €). Pick-up reciente estable (+${pickupMetrics.bestPickup} RN). MANTENER ${barVigente} €; evaluar subida a ${barObjetivo} € ante nueva demanda.`);
                }
            } else {
                action = 'MANTENER';
                proposedPrice = barVigente;
                triggerText = `🔥 MANTENER (${barVigente}€)`;
                demandStatus = 'MÁXIMO RENDIMIENTO';
                isCommerciallyOptimal = true;
                reasons.push(`Ocupación crítica (${effectiveOcc.toFixed(0)}% · ${availableRooms} habs libres). Tarifa vigente (${barVigente} €) cubre la BAR objetivo (${barObjetivo} €). MANTENER.`);
            }
        }

        // === PASO 9: RECOMENDACIÓN COMERCIAL FINAL ===
        // Si la acción es SUBIR pero el precio propuesto es menor o igual a la BAR vigente, MANTENER
        if (action === 'SUBIR' && proposedPrice <= barVigente) {
            action = 'MANTENER';
        }

        const roundedProposed = Math.round(proposedPrice);
        const roundedCurrent = barVigente;
        const diffAmount = roundedProposed - roundedCurrent;
        const diffPct = (roundedCurrent > 0) ? ((diffAmount / roundedCurrent) * 100) : 0;
        const budgetContext = getMonthlyBudget(hotelName, yearNum, monthNum);

        return {
            dateISO,
            hotelName,
            year: yearNum,
            action,
            baseBar,
            barVigente,
            barObjetivo,
            currentPrice: roundedCurrent,
            proposedPrice: roundedProposed,
            minFloorPrice: baseBar,
            diffAmount,
            diffPct,
            daysOut,
            reasons,
            fullReasonText: reasons.join(' '),
            confidenceScore,
            confidenceDetails,
            forecastStatus: occData.forecastStatus,
            budgetContext,
            riskAssessment,
            isException,
            eventName,
            triggerText,
            demandStatus,
            isCommerciallyOptimal,
            hasSufficientPickupHistory: pickupMetrics.hasSufficientHistory,
            pickupMetrics,
            occupancyData: occData,
            minRange: baseBar,
            maxRange: Math.max(baseBar, barObjetivo, barVigente),
            rangeText: `${baseBar} € – ${Math.max(baseBar, barObjetivo, barVigente)} €`,
            rangeCalculation: `Suelo (BAR base): ${baseBar} € · Objetivo: ${barObjetivo} € · Vigente: ${barVigente} €`,
            mathToleranceBand: {
                min: Math.round(barVigente * 0.95),
                max: Math.round(barVigente * 1.05),
                text: `${Math.round(barVigente * 0.95)} € – ${Math.round(barVigente * 1.05)} €`
            }
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

        const bgt = getMonthlyBudget(hotelName, detectedYear, selectedMonthNum);
        const targetRev = bgt.targetRev;
        const targetRN = bgt.targetRN;
        const targetAdr = bgt.targetAdr;
        const targetOcc = bgt.targetOccPct;

        const pendingRev = Math.max(0, targetRev - Math.round(sumRevenue));
        const pendingRN = Math.max(0, targetRN - sumRooms);
        const revCoveragePct = targetRev > 0 ? Number(((sumRevenue / targetRev) * 100).toFixed(1)) : 0;
        const rnCoveragePct = targetRN > 0 ? Number(((sumRooms / targetRN) * 100).toFixed(1)) : 0;
        const gapRevenue = Math.round(sumRevenue - targetRev);
        const gapRN = sumRooms - targetRN;
        const gapOccPct = Number((avgOcc - targetOcc).toFixed(1));

        const pacing = {
            hasHistoricalPace: hasHist,
            paceStatus: hasHist 
                ? (p7dSum > 0 ? `Ritmo positivo (+${p7dSum} RN en 7d)` : (p7dSum < 0 ? `Ritmo negativo (${p7dSum} RN en 7d)` : `Ritmo estable (0 RN en 7d)`))
                : 'Ritmo histórico no disponible',
            paceDetails: hasHist
                ? `Pick-up acumulado en los últimos 7 días: ${p7dSum >= 0 ? '+' : ''}${p7dSum} RN.`
                : 'Sin capturas históricas previas suficientes para este mes. No clasificar la cobertura (% captado) de forma aislada sin ponderar los días de antelación (lead time).'
        };

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
            compGapPct: compGap,
            budget: bgt,
            budgetMetrics: {
                targetRevenue: targetRev,
                targetRN: targetRN,
                targetADR: targetAdr,
                targetOccPct: targetOcc,
                confirmedRevenue: Math.round(sumRevenue),
                confirmedRN: sumRooms,
                confirmedADR: Math.round(forecastADR),
                confirmedOccPct: Number(avgOcc.toFixed(1)),
                pendingRevenue: pendingRev,
                pendingRN: pendingRN,
                revenueCoveragePct: revCoveragePct,
                rnCoveragePct: rnCoveragePct,
                gapRevenue: gapRevenue,
                gapRN: gapRN,
                gapOccPct: gapOccPct
            },
            pacing: pacing
        };
    }

    const api = {
        DEFAULT_BAR_MATRICES,
        DEFAULT_OCC_TIERS,
        OFFICIAL_BUDGET_2027,
        OFFICIAL_BUDGET_2026,
        getMonthlyBudget,
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
        normalizeSnapshotEntry,
        compactSnapshotEntry,
        getSnapshotsDB,
        saveSnapshotsDB,
        recordDailySnapshot,
        captureBatchSnapshots,
        calculateDailyPickup,
        evaluatePickupPace,
        evaluateOccupancyForecast,
        evaluateDailyRecommendation,
        aggregateByDayOfWeek,
        aggregateMonthSummary
    };

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }
    root.PricingIntelligence = api;

})(typeof window === 'object' ? window : globalThis);
