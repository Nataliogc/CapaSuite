/**
 * CapaSuite Storage Manager (PRO Version)
 * Maneja el almacenamiento de datos con múltiples fallbacks:
 * 1. localStorage (Persistente)
 * 2. sessionStorage (Durante la sesión/navegación en la pestaña)
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

    // Readability is independent of write quota. Never hide an existing database.
    function removeExactLegacyDuplicates() {
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && !key.startsWith(VERSION + '_') && !key.startsWith('firebase:') &&
                localStorage.getItem(VERSION + '_' + key) === localStorage.getItem(key)) {
                localStorage.removeItem(key);
            }
        }
    }

    // Leave headroom for Firebase's small connection/auth metadata writes.
    function writeWithHeadroom(key, value) {
        const reserve = '__capasuite_headroom__';
        try {
            localStorage.setItem(reserve, ' '.repeat(32768));
            localStorage.setItem(key, value);
        } finally {
            localStorage.removeItem(reserve);
        }
    }

    try {
        localStorage.getItem('__capasuite_test__');
        storageAvailable = true;
        removeExactLegacyDuplicates();
    } catch (e) {
        console.warn?.('CapaSuite: almacenamiento local no accesible.');
    }

    // 2. Fallback de sessionStorage (Persistencia entre páginas en la misma pestaña)
    // Reemplaza el antiguo window.name que era legible por iframes/popups.
    let sessionAvailable = false;
    try {
        const _t = '__cs_sess_test__';
        sessionStorage.setItem(_t, _t);
        sessionStorage.removeItem(_t);
        sessionAvailable = true;
    } catch (e) { }

    function saveToSession(key, value) {
        if (!sessionAvailable) return false;
        try { sessionStorage.setItem('_cs_' + key, value); return true; } catch (e) { return false; }
    }

    function getFromSession(key) {
        if (!sessionAvailable) return null;
        try { return sessionStorage.getItem('_cs_' + key) ?? null; } catch (e) { return null; }
    }

    function removeFromSession(key) {
        if (!sessionAvailable) return;
        try { sessionStorage.removeItem('_cs_' + key); } catch (e) { }
    }

    window.CapaStorage = {
        isAvailable: storageAvailable,

        getItem: function (key) {
            if (Object.hasOwn(memoryStorage, key)) return memoryStorage[key];
            try {
                if (sessionAvailable && sessionStorage.getItem('_cs_dirty_' + key)) return getFromSession(key);
            } catch (e) { }
            // Intentar localStorage con y sin versión por retrocompatibilidad
            let val = null;
            if (storageAvailable) {
                try { val = localStorage.getItem(`${VERSION}_${key}`) ?? localStorage.getItem(key); } catch (e) { }
            }
            
            // Fallbacks
            if (val == null) val = getFromSession(key);


            // Segment names belong to the source report. Reading storage must not delete them.

            // Dates are source data. Reading storage must never rewrite them.

            return val;
        },

        setItem: function (key, value) {
            // Guardar en todas partes para máxima resiliencia usando prefix de versión
            let persisted = false;
            if (storageAvailable) {
                try { 
                    writeWithHeadroom(`${VERSION}_${key}`, value);
                    persisted = true;
                } catch (e) { 
                    // Si se alcanza el límite de cuota (5MB), purgar SOLO copias legacy sin prefijo que ya
                    // están duplicadas con prefijo v3_ (getItem nunca las lee). Las claves sin duplicado
                    // (hotel activo, tema, ajustes, datos antiguos) siguen siendo necesarias y no se tocan.
                    try {
                        removeExactLegacyDuplicates();
                        writeWithHeadroom(VERSION + '_' + key, value);
                        persisted = true;
                    } catch (_) { }

                    if (!persisted) {
                        if (typeof console !== 'undefined' && console.warn) {
                            console.warn(`[CapaSuite Storage] Cuota de localStorage superada para '${key}'. Guardando en memoria/sesión de respaldo.`, e);
                        }
                    }
                }
            }
            const savedInSession = saveToSession(key, value);
            try {
                if (persisted) sessionStorage.removeItem('_cs_dirty_' + key);
                else if (savedInSession) sessionStorage.setItem('_cs_dirty_' + key, '1');
            } catch (e) { }
            if (persisted) delete memoryStorage[key];
            else {
                memoryStorage[key] = value;
                window.dispatchEvent?.(new CustomEvent('capasuite-storage-warning', { detail: { key } }));
            }
            return { persistent: persisted, session: savedInSession };
        },

        removeItem: function (key) {
            if (storageAvailable) {
                localStorage.removeItem(`${VERSION}_${key}`);
                localStorage.removeItem(key); // Limpiar versión antigua también
            }
            removeFromSession(key);
            try { sessionStorage.removeItem('_cs_dirty_' + key); } catch (e) { }
            delete memoryStorage[key];
        },

        showWarningIfNeeded: function () {
            if (!storageAvailable) {
                console.info("CapaSuite funcionando en modo Sesión Avanzada (sessionStorage/memory).");
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

    // Sincronización reactiva entre pestañas del mismo navegador
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
        window.addEventListener('storage', (event) => {
            if (!event || !event.key) return;
            const prefix = VERSION + '_';
            const logicalKey = event.key.startsWith(prefix) ? event.key.slice(prefix.length) : event.key;
            if (!logicalKey || logicalKey.startsWith('__') || logicalKey.startsWith('_cs_') || logicalKey.startsWith('firebase:')) return;

            delete memoryStorage[logicalKey];
            try { sessionStorage.removeItem('_cs_dirty_' + logicalKey); } catch (e) { }
            if (event.newValue == null) {
                removeFromSession(logicalKey);
            } else {
                saveToSession(logicalKey, event.newValue);
            }

            if (logicalKey !== 'active_hotel_suite' && logicalKey !== 'capasuite_theme') {
                window.dispatchEvent?.(new CustomEvent('capasuite-data-synced', {
                    detail: { keys: [logicalKey], source: 'storage' }
                }));
            }
        });
    }

    // Auto-init
    CapaStorage.showWarningIfNeeded();

})();
