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
            // Intentar localStorage
            if (storageAvailable) {
                const val = localStorage.getItem(key);
                if (val) return val;
            }
            // Intentar window.name (fallback para navegación de archivos locales)
            const winVal = getFromWindowName(key);
            if (winVal) return winVal;

            // Intentar memoria
            return memoryStorage[key] || null;
        },

        setItem: function (key, value) {
            // Guardar en todas partes para máxima resiliencia
            if (storageAvailable) {
                try { localStorage.setItem(key, value); } catch (e) { }
            }
            saveToWindowName(key, value);
            memoryStorage[key] = value;
        },

        removeItem: function (key) {
            if (storageAvailable) {
                localStorage.removeItem(key);
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
