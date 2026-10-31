/** Shared navigation and hotel selection. Existing page handlers keep rendering their views. */
(function () {
    'use strict';
    function savedHotel() {
        try { return localStorage.getItem('active_hotel_suite') || 'Guadiana'; }
        catch (e) { return 'Guadiana'; }
    }
    function persistHotel(hotel) {
        if (!['Guadiana', 'Cumbria'].includes(hotel)) return;
        if (window.CapaState) window.CapaState.setActiveHotel(hotel);
        else { try { localStorage.setItem('active_hotel_suite', hotel); } catch (e) { } }
        if (document.querySelectorAll) {
            document.querySelectorAll('#hotelSelector, #hotelSelectorNav').forEach(sel => { sel.value = hotel; });
        }
    }
    window.switchHotel = persistHotel;
    function decorate(nav) {
        if (document.querySelectorAll) {
            document.querySelectorAll('#hotelSelector, #hotelSelectorNav').forEach(sel => { sel.value = savedHotel(); });
        }
        const page = window.location.pathname.split('/').pop() || 'index.html';
        nav.querySelectorAll('.nav-links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === page));
        const links = nav.querySelector('.nav-links');
        if (links && !links.querySelector('a[href="HistoricoAlojamiento.html"]')) {
            const prodLink = links.querySelector('a[href="AnalisisProduccion.html"]');
            const hLink = document.createElement('a'); hLink.href = 'HistoricoAlojamiento.html'; hLink.textContent = 'Histórico Alojamiento';
            hLink.classList.toggle('active', page === 'HistoricoAlojamiento.html');
            if (prodLink && prodLink.nextSibling) links.insertBefore(hLink, prodLink.nextSibling);
            else links.append(hLink);
        }
        if (links) {
            links.querySelectorAll('a[href="SeguimientoRevenue.html"]').forEach(el => el.remove());
        }
        if (links && !links.querySelector('a[href="CargarDatos.html"]')) {
            const link = document.createElement('a'); link.href = 'CargarDatos.html'; link.textContent = 'Cargar Datos';
            link.classList.toggle('active', page === 'CargarDatos.html'); links.append(link);
        }
        const user = window.auth?.currentUser || (window.getSavedAuthSession && window.getSavedAuthSession());
        const email = nav.querySelector('#userEmailNav');
        if (email && window._capasuite_local_mode && !user) email.textContent = 'Modo local';
        if (email && user) email.textContent = window.getUserDisplayName ? window.getUserDisplayName(user) : (user.displayName || user.email);
        if (window.CAPASUITE_VERSION) {
            nav.querySelectorAll('.app-version-badge, [data-version-badge]').forEach(el => {
                el.innerHTML = `<span class="version-dot"></span><span>v${window.CAPASUITE_VERSION.version}</span>`;
                el.title = `CapaSuite v${window.CAPASUITE_VERSION.version} · Compilación: ${window.CAPASUITE_VERSION.buildDate}`;
            });
        }
        const logoutIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>';
        nav.querySelectorAll('.logout-btn').forEach(btn => {
            if (!btn.querySelector('svg')) btn.innerHTML = logoutIconSvg;
            if (!btn.getAttribute('title')) btn.setAttribute('title', 'Cerrar sesión');
            btn.setAttribute('aria-label', 'Cerrar sesión');
        });
    }
    async function injectNav() {
        const existing = document.getElementById('mainNav') || document.querySelector('nav.top-nav');
        if (existing && existing.children.length) { existing.id = 'mainNav'; decorate(existing); return; }
        try {
            const response = await fetch('partials/nav.html');
            if (!response.ok) throw new Error('No se pudo cargar la navegación');
            const template = document.createElement('template');
            template.innerHTML = await response.text();
            const nav = template.content.querySelector('nav');
            if (!nav) throw new Error('Navegación no válida');
            if (existing) { existing.innerHTML = nav.innerHTML; decorate(existing); }
            else { document.body.prepend(nav); decorate(nav); }
        } catch (error) { console.error('CapaSuite Nav:', error); }
    }
    document.addEventListener('change', event => {
        if (['hotelSelector', 'hotelSelectorNav'].includes(event.target.id)) persistHotel(event.target.value);
    }, true);
    window.CapaNavReady = new Promise(resolve => {
        document.addEventListener('DOMContentLoaded', () => { injectNav().then(resolve); }, { once: true });
    });
    window.addEventListener('load', async () => {
        await window.CapaNavReady;
        setTimeout(() => {
            const sel = document.getElementById('hotelSelector') || document.getElementById('hotelSelectorNav');
            if (sel) { sel.value = savedHotel(); sel.dispatchEvent(new Event('change', { bubbles: true })); }
        }, 0);
    });
})();
