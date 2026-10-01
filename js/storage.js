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
                    localStorage.setItem(`${VERSION}_${key}`, value);
                    persisted = true;
                } catch (e) { 
                    logError("Fallo guardando en localStorage (Posible límite de cuota excedido)", { key });
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

    // Auto-init
    CapaStorage.showWarningIfNeeded();

})();
