/**
 * CapaSuite - Versión Global de la Aplicación
 * 
 * POLÍTICA DE CONTROL DE VERSIONES:
 * A partir de esta versión, SIEMPRE que se realice cualquier modificación
 * en el código o módulos de CapaSuite, se incrementará la versión aquí y en los badges.
 */
(function () {
    'use strict';

    const APP_VERSION = '2.7.5';
    const BUILD_DATE = '28/10/2026';
    const BUILD_TIMESTAMP = '2026-10-28 21:55';

    window.CAPASUITE_VERSION = {
        version: APP_VERSION,
        buildDate: BUILD_DATE,
        buildTimestamp: BUILD_TIMESTAMP,
        fullLabel: `v${APP_VERSION} (${BUILD_DATE})`
    };

    function updateVersionBadges() {
        document.querySelectorAll('.app-version-badge, [data-version-badge]').forEach(el => {
            el.innerHTML = `<span class="version-dot"></span><span>v${APP_VERSION}</span>`;
            el.title = `CapaSuite v${APP_VERSION} · Compilación: ${BUILD_DATE} (${BUILD_TIMESTAMP})`;
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', updateVersionBadges);
    } else {
        updateVersionBadges();
    }
})();
