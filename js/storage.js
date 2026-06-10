/**
 * CapaSuite Storage Manager (PRO Version)
 * Maneja el almacenamiento de datos con múltiples fallbacks:
 * 1. localStorage (Persistente)
 * 2. window.name (Persistente durante la sesión/navegación en la pestaña)
 * 3. Memory (Solo sesión actual)
 */

(function () {
    'use strict';

    let storageAvailable = false;
    let memoryStorage = {};
    const VERSION = "v3";

    // Función de error central de la Fase 2 (Detecta errores silenciosos)
    window.logError = function (msg, data) {
        console.error(`[CapaSuite ERROR - ${new Date().toISOString()}]`, msg, data || '');
    };

    // 1. Probar localStorage
    try {
        const testKey = '__capasuite_test__';
        localStorage.setItem(testKey, testKey);
        localStorage.removeItem(testKey);
        storageAvailable = true;
    } catch (e) {
        storageAvailable = false;
        console.warn('CapaSuite: localStorage bloqueado. Usando modo de sesión avanzada.');
    }

    // 2. Fallback de window.name (Persistencia entre páginas en la misma pestaña)
    function saveToWindowName(key, value) {
        try {
            let data = {};
            if (window.name && window.name.startsWith('{')) {
                data = JSON.parse(window.name);
            }
            data[key] = value;
            window.name = JSON.stringify(data);
        } catch (e) { }
    }

    function getFromWindowName(key) {
        try {
            if (window.name && window.name.startsWith('{')) {
                const data = JSON.parse(window.name);
                return data[key] || null;
            }
        } catch (e) { }
        return null;
    }

    function removeFromWindowName(key) {
        try {
            if (window.name && window.name.startsWith('{')) {
                const data = JSON.parse(window.name);
                delete data[key];
                window.name = JSON.stringify(data);
            }
        } catch (e) { }
    }

    window.CapaStorage = {
        isAvailable: storageAvailable,

        getItem: function (key) {
            // Intentar localStorage con y sin versión por retrocompatibilidad
            let val = null;
            if (storageAvailable) {
                val = localStorage.getItem(`${VERSION}_${key}`) || localStorage.getItem(key);
            }
            
            // Fallbacks
            if (!val) val = getFromWindowName(key);
            if (!val) val = memoryStorage[key];

            // --- CAPASUITE SEGMENT PURGE FIX (One-time check per session) ---
            if (key === "hotel_manager_db_v2" && val && !window.__capasuite_purged_v3__) {
                try {
                    const db = JSON.parse(val);
                    const known = ["CORPORATIVO LINEAL", "DIRECTO OFFLINE", "DIRONLINE", "GRTANTEO", "GRUPOS", "OTA/AAVV", "OTROS", "PARTICULARES", "TTOO DINAMICA"];
                    
                    const normalize = (s) => String(s || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
                    const knownNorm = known.map(k => normalize(k));

                    let changed = false;
                    Object.keys(db).forEach(h => {
                        if (typeof db[h] !== 'object') return;
                        Object.keys(db[h]).forEach(y => {
                            if (db[h][y] && db[h][y].segment) {
                                Object.keys(db[h][y].segment).forEach(s => {
                                    if (!knownNorm.includes(normalize(s))) {
                                        delete db[h][y].segment[s];
                                        changed = true;
                                    }
                                });
                            }
                        });
                    });
                    if (changed) {
                        val = JSON.stringify(db);
                        this.setItem(key, val);
                        console.log("🛠️ CapaSuite: Global Database Purge logic executed (normalized).");
                    }
                    window.__capasuite_purged_v3__ = true;
                } catch(e) { console.warn("Purge Fail", e); }
            }

            // --- CAPASUITE DATE SHIFT CORRECTION MIGRATION (One-time correction) ---
            if (key === "hotel_manager_db_v2" && val) {
                try {
                    const db = JSON.parse(val);
                    const isReconciliationComplete = (window._capasuite_local_mode === true || window._initialDownloadDone === true);
                    
                    if (db && typeof db === 'object' && !db._dateShiftMigratedV4 && isReconciliationComplete) {
                        const shiftDateString = (dateStr) => {
                            const parts = dateStr.split('-');
                            if (parts.length === 3) {
                                const y = parseInt(parts[0]);
                                const m = parseInt(parts[1]) - 1;
                                const d = parseInt(parts[2]);
                                const utcDate = new Date(Date.UTC(y, m, d));
                                utcDate.setUTCDate(utcDate.getUTCDate() + 1);
                                
                                const newY = utcDate.getUTCFullYear();
                                const newM = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
                                const newD = String(utcDate.getUTCDate()).padStart(2, '0');
                                return `${newY}-${newM}-${newD}`;
                            }
                            return dateStr;
                        };

                        Object.keys(db).forEach(hotel => {
                            if (hotel.startsWith('_') || typeof db[hotel] !== 'object') return;
                            Object.keys(db[hotel]).forEach(year => {
                                if (year.startsWith('_') || typeof db[hotel][year] !== 'object') return;
                                const yearData = db[hotel][year];
                                if (yearData && typeof yearData === 'object') {
                                    if (yearData.daily && typeof yearData.daily === 'object') {
                                        const newDaily = {};
                                        Object.entries(yearData.daily).forEach(([dateStr, dayData]) => {
                                            newDaily[shiftDateString(dateStr)] = dayData;
                                        });
                                        yearData.daily = newDaily;
                                    }
                                    if (yearData.daily_otb && typeof yearData.daily_otb === 'object') {
                                        const newDailyOtb = {};
                                        Object.entries(yearData.daily_otb).forEach(([dateStr, dayData]) => {
                                            newDailyOtb[shiftDateString(dateStr)] = dayData;
                                        });
                                        yearData.daily_otb = newDailyOtb;
                                    }
                                    if (yearData.otb_prev && yearData.otb_prev.daily_otb && typeof yearData.otb_prev.daily_otb === 'object') {
                                        const newDailyOtbPrev = {};
                                        Object.entries(yearData.otb_prev.daily_otb).forEach(([dateStr, dayData]) => {
                                            newDailyOtbPrev[shiftDateString(dateStr)] = dayData;
                                        });
                                        yearData.otb_prev.daily_otb = newDailyOtbPrev;
                                    }
                                }
                            });
                        });

                        db._dateShiftMigratedV4 = true;
                        val = JSON.stringify(db);
                        this.setItem(key, val);
                        console.log("🛠️ CapaSuite: Global Database Date Shift correction applied & marked in DB.");
                    }
                } catch(e) { console.warn("Date Shift Correction Fail", e); }
            }

            return val;
        },

        setItem: function (key, value) {
            // Guardar en todas partes para máxima resiliencia usando prefix de versión
            if (storageAvailable) {
                try { 
                    localStorage.setItem(`${VERSION}_${key}`, value); 
                } catch (e) { 
                    logError("Fallo guardando en localStorage (Posible límite de cuota excedido)", { key });
                }
            }
            saveToWindowName(key, value);
            memoryStorage[key] = value;
        },

        removeItem: function (key) {
            if (storageAvailable) {
                localStorage.removeItem(`${VERSION}_${key}`);
                localStorage.removeItem(key); // Limpiar versión antigua también
            }
            removeFromWindowName(key);
            delete memoryStorage[key];
        },

        showWarningIfNeeded: function () {
            if (!storageAvailable) {
                console.info("CapaSuite funcionando en modo Sesión Avanzada (window.name/memory).");
            }
        },

        showHowToFix: function () {
            alert(
                '🔧 PERSISTENCIA DE DATOS:\n\n' +
                'Para que los datos se guarden para siempre:\n' +
                '1. Usa el archivo INICIAR_SERVIDOR.bat\n' +
                '2. O cambia la configuración de Tracking Prevention de tu navegador a "Básico".\n\n' +
                'Actualmente estamos usando "Modo Pestaña": los datos se mantienen mientras no cierres esta pestaña.'
            );
        }
    };

    // Auto-init
    CapaStorage.showWarningIfNeeded();

})();
