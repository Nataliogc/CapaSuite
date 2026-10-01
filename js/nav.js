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
        document.querySelectorAll('#hotelSelector, #hotelSelectorNav').forEach(sel => { sel.value = hotel; });
    }
    window.switchHotel = persistHotel;
    function decorate(nav) {
        document.querySelectorAll('#hotelSelector, #hotelSelectorNav').forEach(sel => { sel.value = savedHotel(); });
        const page = window.location.pathname.split('/').pop() || 'index.html';
        nav.querySelectorAll('.nav-links a').forEach(a => a.classList.toggle('active', a.getAttribute('href') === page));
        const links = nav.querySelector('.nav-links');
        if (links && !links.querySelector('a[href="SeguimientoRevenue.html"]')) {
            const link = document.createElement('a'); link.href = 'SeguimientoRevenue.html'; link.textContent = 'Seguimiento';
            link.classList.toggle('active', page === 'SeguimientoRevenue.html'); links.append(link);
        }
        const user = window.auth?.currentUser;
        const email = nav.querySelector('#userEmailNav');
        if (email && window._capasuite_local_mode && !user) email.textContent = 'Modo local';
        if (email && user) email.textContent = window.getUserDisplayName ? window.getUserDisplayName(user) : user.email;
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
