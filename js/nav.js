/**
 * CapaSuite — Nav Loader
 * Inyecta el nav compartido (partials/nav.html) en el body,
 * marca el enlace activo automáticamente y restaura el hotel seleccionado.
 *
 * Uso: incluir este script ANTES de firebase-auth.js en el <head>.
 * El nav se inserta como primer hijo del <body> antes de que cargue el DOM.
 */
(function () {
    'use strict';

    /**
     * Inserta el nav en el DOM. Se llama en DOMContentLoaded para
     * páginas que ya tienen un <nav id="mainNav"> (index.html), y con
     * fetch para el resto.
     */
    function markActiveLink() {
        const page = window.location.pathname.split('/').pop() || 'index.html';
        const links = document.querySelectorAll('#mainNav .nav-links a');
        links.forEach(a => {
            const href = a.getAttribute('href');
            a.classList.toggle('active', href === page);
        });
    }

    function restoreHotelSelector() {
        const sel = document.getElementById('hotelSelectorNav');
        if (!sel) return;
        const saved = localStorage.getItem('active_hotel_suite') || 'Guadiana';
        sel.value = saved;
    }

    /**
     * switchHotel — accesible globalmente desde el onchange del <select>.
     * Persiste en localStorage y notifica al resto del sistema via CapaState.
     */
    window.switchHotel = function (hotel) {
        localStorage.setItem('active_hotel_suite', hotel);
        if (window.CapaState && typeof window.CapaState.setActiveHotel === 'function') {
            window.CapaState.setActiveHotel(hotel);
        } else {
            window.dispatchEvent(new CustomEvent('hotel-changed', { detail: hotel }));
        }

        // Toast feedback
        const toast = document.createElement('div');
        toast.style.cssText = [
            'position:fixed', 'bottom:24px', 'left:50%',
            'transform:translateX(-50%)',
            'background:#10b981', 'color:#fff',
            'padding:10px 22px', 'border-radius:50px',
            'font-weight:700', 'font-size:0.85rem',
            'z-index:99999', 'box-shadow:0 4px 20px rgba(0,0,0,0.2)',
            'pointer-events:none'
        ].join(';');
        toast.textContent = '🏨 Hotel: ' + hotel;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2200);
    };

    // --- Cargar el nav parcial con fetch (para páginas que no tengan nav inline) ---
    function injectNav() {
        // Si la página ya tiene el nav (index.html lo tiene inline), solo marcar activo
        if (document.getElementById('mainNav')) {
            markActiveLink();
            restoreHotelSelector();
            return;
        }

        fetch('partials/nav.html')
            .then(r => r.text())
            .then(html => {
                document.body.insertAdjacentHTML('afterbegin', html);
                markActiveLink();
                restoreHotelSelector();
            })
            .catch(() => {
                // Si falla el fetch (ej. file:// sin servidor), construir nav mínimo
                console.warn('CapaSuite Nav: no se pudo cargar partials/nav.html');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', injectNav);
    } else {
        injectNav();
    }
})();
