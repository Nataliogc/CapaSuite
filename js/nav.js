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
        nav.querySelectorAll('.nav-links a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === page);
            a.addEventListener('click', () => {
                if (window.manualPricesPending) return;
                const heavyTable = document.getElementById('tableBody');
                if (heavyTable) heavyTable.textContent = '';
            });
        });
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
        const emailEl = nav.querySelector('#userEmailNav');
        if (emailEl) {
            if (window._capasuite_local_mode && !user) {
                emailEl.innerHTML = '<span style="color:#ef4444; font-weight:800; cursor:pointer;" onclick="localStorage.setItem(\'force_login_once\', \'true\'); location.reload()">🚀 MODO LOCAL</span>';
            } else if (user) {
                const displayName = window.getUserDisplayName ? window.getUserDisplayName(user) : (user.displayName || user.email || 'Usuario');
                const userInitial = displayName.charAt(0).toUpperCase();
                const userEmail = (user.email || '').toLowerCase().trim();

                // Resolver Rol
                let userRole = user.role;
                if (!userRole) {
                    try {
                        const sysUsers = window.getSystemUsers ? window.getSystemUsers() : [];
                        const m = sysUsers.find(u => u.email && u.email.toLowerCase().trim() === userEmail);
                        if (m && m.role) userRole = m.role;
                    } catch {}
                }
                if (!userRole) {
                    if (userEmail === 'comunicaciones@hotelguadiana.es' || userEmail === 'admin@capasuite.com') {
                        userRole = 'Administrador';
                    } else if (userEmail.includes('guadiana')) {
                        userRole = 'Dirección';
                    } else {
                        userRole = 'Comercial';
                    }
                }

                const isAdmin = (userRole.toLowerCase() === 'administrador' || userEmail === 'comunicaciones@hotelguadiana.es' || userEmail === 'admin@capasuite.com' || window._capasuite_local_mode);

                const shieldIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>';
                const keyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/></svg>';

                emailEl.innerHTML = `
                    <div class="capa-user-nexus-widget" style="display:inline-flex; align-items:center; gap:6px; padding:2px 8px 2px 5px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.12); border-radius:9999px; box-shadow:0 1px 3px rgba(0,0,0,0.1); select-none;" title="Usuario: ${displayName} (${userEmail})">
                        <div style="width:20px; height:20px; border-radius:50%; background:linear-gradient(135deg, #065f46, #10b981); color:#fff; font-size:10px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0;">
                            ${userInitial}
                        </div>
                        <div style="display:flex; flex-direction:column; text-align:left; line-height:1; padding-right:2px;">
                            <span style="font-size:11px; font-weight:800; color:var(--text-main, #f9fafb);">${displayName}</span>
                            <span style="font-size:7.5px; font-weight:800; color:#10b981; text-transform:uppercase; letter-spacing:0.04em; margin-top:1px;">${userRole}</span>
                        </div>
                        <button type="button" onclick="window.openChangeMyPasswordModal && window.openChangeMyPasswordModal()" style="background:transparent; border:none; padding:2px; color:var(--text-muted, #94a3b8); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:all 0.2s;" title="Cambiar mi contraseña" onmouseover="this.style.color='#f59e0b'" onmouseout="this.style.color='var(--text-muted)'">
                            ${keyIconSvg}
                        </button>
                        ${isAdmin ? `
                        <a href="Usuarios.html" style="background:transparent; border:none; padding:2px; color:var(--text-muted, #94a3b8); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; text-decoration:none; transition:all 0.2s;" title="Gestión de usuarios y credenciales (Solo Admin)" onmouseover="this.style.color='#10b981'" onmouseout="this.style.color='var(--text-muted)'">
                            ${shieldIconSvg}
                        </a>
                        ` : ''}
                    </div>
                `;
            }
        }
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
