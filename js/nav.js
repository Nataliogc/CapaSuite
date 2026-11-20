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
    
    function renderNexusUserWidget(user) {
        const emailEl = document.getElementById('userEmailNav');
        if (!emailEl) return;

        // Ocultar cualquier punto verde residual
        document.querySelectorAll('.user-chip .dot').forEach(d => { if (d && d.style) d.style.display = 'none'; });
        // Ocultar botón logout residual exterior si existe
        const outerLogout = document.querySelector('.user-chip > .logout-btn');
        if (outerLogout && outerLogout.style) outerLogout.style.display = 'none';

        user = user || window.auth?.currentUser || (window.getSavedAuthSession && window.getSavedAuthSession());

        if (!user && window._capasuite_local_mode) {
            emailEl.innerHTML = '<span style="color:#ef4444; font-weight:800; cursor:pointer;" onclick="localStorage.setItem(\'force_login_once\', \'true\'); location.reload()">🚀 MODO LOCAL</span>';
            return;
        }

        if (!user) {
            emailEl.innerHTML = '<span style="color:var(--text-muted); font-size:11px;">Conectando...</span>';
            return;
        }

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
            if (userEmail === 'comunicaciones@hotelguadiana.es' || userEmail === 'admin@capasuite.com' || displayName.toLowerCase() === 'natalio') {
                userRole = 'Administrador';
            } else if (userEmail.includes('guadiana')) {
                userRole = 'Dirección';
            } else {
                userRole = 'Comercial';
            }
        }

        const isAdmin = (userRole.toLowerCase() === 'administrador' || userEmail === 'comunicaciones@hotelguadiana.es' || userEmail === 'admin@capasuite.com' || displayName.toLowerCase() === 'natalio' || window._capasuite_local_mode);

        const shieldIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><path d="m9 12 2 2 4-4"></path></svg>';
        const keyIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="7.5" cy="15.5" r="5.5"></circle><path d="m21 2-9.6 9.6"></path><path d="m15.5 7.5 3 3L22 7l-3-3"></path></svg>';
        const logoutIconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';

        emailEl.innerHTML = `
            <div class="nexus-user-pill-widget" style="display:inline-flex; align-items:center; gap:6px; padding:3px 10px 3px 5px; background:rgba(255,255,255,0.08); border:1px solid rgba(255,255,255,0.15); border-radius:9999px; box-shadow:0 1px 4px rgba(0,0,0,0.12); select-none; vertical-align:middle;" title="Usuario: ${displayName} (${userEmail})">
                <div style="width:22px; height:22px; border-radius:50%; background:linear-gradient(135deg, #15803d, #10b981); color:#ffffff; font-size:11px; font-weight:900; display:flex; align-items:center; justify-content:center; flex-shrink:0; box-shadow:0 1px 3px rgba(0,0,0,0.2);">
                    ${userInitial}
                </div>
                <div style="display:flex; flex-direction:column; text-align:left; line-height:1; padding-right:4px;">
                    <span style="font-size:11.5px; font-weight:800; color:var(--text-main, #0f172a); letter-spacing:-0.01em;">${displayName}</span>
                    <span style="font-size:7.5px; font-weight:900; color:#10b981; text-transform:uppercase; letter-spacing:0.06em; margin-top:1.5px;">${userRole}</span>
                </div>
                <button type="button" onclick="window.openChangeMyPasswordModal && window.openChangeMyPasswordModal()" style="background:transparent; border:none; padding:3px; color:var(--text-muted, #64748b); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:all 0.2s;" title="Cambiar mi contraseña" onmouseover="this.style.color='#f59e0b'" onmouseout="this.style.color='var(--text-muted, #64748b)'">
                    ${keyIconSvg}
                </button>
                ${isAdmin ? `
                <a href="Usuarios.html" style="background:transparent; border:none; padding:3px; color:var(--text-muted, #64748b); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; text-decoration:none; transition:all 0.2s;" title="Gestión de usuarios y accesos (Solo Administrador)" onmouseover="this.style.color='#10b981'" onmouseout="this.style.color='var(--text-muted, #64748b)'">
                    ${shieldIconSvg}
                </a>
                ` : ''}
                <button type="button" onclick="auth.signOut()" style="background:transparent; border:none; padding:3px; color:var(--text-muted, #64748b); cursor:pointer; display:flex; align-items:center; justify-content:center; border-radius:50%; transition:all 0.2s;" title="Cerrar sesión" onmouseover="this.style.color='#f43f5e'" onmouseout="this.style.color='var(--text-muted, #64748b)'">
                    ${logoutIconSvg}
                </button>
            </div>
        `;

        // Proteger contra sobreescritura accidental por scripts antiguos
        if (!emailEl._hasNexusObserver) {
            emailEl._hasNexusObserver = true;
            const obs = new MutationObserver(() => {
                if (!emailEl.querySelector('.nexus-user-pill-widget')) {
                    obs.disconnect();
                    emailEl._hasNexusObserver = false;
                    renderNexusUserWidget(user);
                }
            });
            obs.observe(emailEl, { childList: true, characterData: true });
        }
    }
    window.renderNexusUserWidget = renderNexusUserWidget;

    function addModuleMenu(nav, links, page) {
        // Ship the panel styles with its markup so cached page styles cannot leave it unstyled.
        if (!document.getElementById('module-menu-styles')) {
            const style = document.createElement('style');
            style.id = 'module-menu-styles';
            style.textContent = `#mainNav .module-trigger {
    flex: none;
    border: 0;
    border-radius: 7px;
    padding: 7px 10px;
    background: #4f46e5;
    color: white;
    font: 700 13px system-ui;
    cursor: pointer;
}
#mainNav .nav-links a[hidden] { display: none !important; }
#module-panel {
    position: fixed;
    inset: auto;
    left: 10px;
    margin: 0;
    box-sizing: border-box;
    width: min(290px, calc(100vw - 20px));
    max-height: calc(100dvh - 75px);
    overflow: auto;
    padding: 0;
    border: 1px solid var(--menu-line, #39465d);
    border-radius: 14px;
    background: var(--menu-bg, #182235);
    color: var(--menu-ink, #e5eaf3);
    box-shadow: 0 14px 38px rgba(15,23,42,.21);
    font: 14px/1.4 system-ui;
    text-align: left;
}
[data-theme="light"] #module-panel {
    --menu-bg: #fff;
    --menu-ink: #263249;
    --menu-line: #dce1eb;
    --menu-accent: #4940b9;
    --menu-strip: #f6f7fc;
}
#module-panel > strong {
    display: block;
    padding: 13px 16px 10px;
    border-bottom: 1px solid var(--menu-line, #39465d);
    font-size: 16px;
}
#module-panel .module-list, #module-panel .module-options { padding: 6px; }
#module-panel a, #module-panel label, #module-panel summary {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 7px 10px;
    border-radius: 7px;
    color: inherit;
    text-decoration: none;
    cursor: pointer;
}
#module-panel a svg { flex: none; color: var(--menu-accent, #b4afff); }
#module-panel a:hover, #module-panel label:hover { background: #818cf816; }
#module-panel a.active {
    color: var(--menu-accent, #ccc8ff);
    background: #818cf826;
    font-weight: 700;
    box-shadow: inset 3px 0 #7066ef;
}
#module-panel details {
    border-top: 1px solid var(--menu-line, #39465d);
    background: var(--menu-strip, #202c40);
}
#module-panel summary {
    padding: 12px 16px;
    font-weight: 650;
    justify-content: space-between;
}
#module-panel summary::after {
    content: '';
    width: 7px;
    height: 7px;
    border: solid currentColor;
    border-width: 0 2px 2px 0;
    transform: rotate(45deg);
}
#module-panel details[open] summary::after { transform: rotate(225deg); }
#module-panel:has(details[open]) .module-list { display: none; }
#module-panel input { width: 16px; height: 16px; margin: 0; accent-color: #554add; }
#module-panel :focus-visible { outline: 2px solid #8178fa; outline-offset: -2px; }
@media (max-width: 900px) {
    #mainNav .nav-links { display: none !important; }
    #mainNav .nav-user { width: auto !important; min-width: 0; flex: 1; overflow-x: auto; }
    #mainNav { flex-wrap: nowrap !important; }
}`;
            document.head.append(style);
        }
        const tabs = Array.from(links.querySelectorAll('a[href]'));
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'module-trigger';
        button.textContent = '☰ Menú';
        button.setAttribute('popovertarget', 'module-panel');
        links.before(button);

        const panel = document.createElement('div');
        panel.id = 'module-panel';
        panel.setAttribute('popover', 'auto');
        panel.innerHTML = `<strong>Módulos</strong><div class="module-list"></div>
            <details><summary>Configurar pestañas</summary><div class="module-options"></div></details>`;
        nav.append(panel);
        const options = panel.querySelector('.module-options');
        const list = panel.querySelector('.module-list');
        const defaults = ['index.html', 'AnalisisProduccion.html', 'AnalisisCalendario.html'];
        function preferenceKey() {
            const user = window.auth?.currentUser || window.getSavedAuthSession?.();
            return 'capasuite.tabs.' + (user?.email?.toLowerCase() || user?.uid || 'local');
        }
        function refresh() {
            let selected = defaults;
            try {
                const saved = JSON.parse(localStorage.getItem(preferenceKey()));
                if (Array.isArray(saved)) selected = saved;
            } catch {}
            tabs.forEach((tab, index) => {
                const pinned = selected.includes(tab.getAttribute('href'));
                options.children[index].firstChild.checked = pinned;
                tab.hidden = !pinned;
            });
        }
        const iconPaths = {
            'index.html': 'M3 10 12 3l9 7 M5 9v12h5v-7h4v7h5V9',
            'AnalisisProduccion.html': 'M4 20h16 M6 16v-4 M12 16V8 M18 16V4',
            'HistoricoAlojamiento.html': 'M3 5v5h5 M3 10a9 9 0 1 1 1 8 M12 7v5l4 2',
            'AnalisisSegmentos.html': 'M11 3a9 9 0 1 0 10 10H11z M14 3v7h7a8 8 0 0 0-7-7z',
            'AnalisisCompetencia.html': 'M3 18l6-7 4 3 8-10 M15 4h6v6',
            'AnalisisCalendario.html': 'M4 6h16v15H4z M4 10h16 M8 3v5 M16 3v5',
            'CalculadoraPresupuesto.html': 'M5 3h14v18H5z M8 7h8 M8 12h2 M14 12h2 M8 16h2 M14 16h2',
            'Analisis360.html': 'M2 12q10-15 20 0-10 15-20 0z M15 12a3 3 0 1 1-6 0 3 3 0 1 1 6 0',
            'AnalisisIA.html': 'M12 3l2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5z',
            'CargarDatos.html': 'M12 16V3 M7 8l5-5 5 5 M4 15v6h16v-6'
        };
        tabs.forEach(tab => {
            const entry = tab.cloneNode(true);
            if (tab.getAttribute('href') === page) entry.setAttribute('aria-current', 'page');
            const path = iconPaths[tab.getAttribute('href')] || 'M4 4h16v16H4z';
            entry.insertAdjacentHTML('afterbegin', `<svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="${path}"/></svg>`);
            list.append(entry);
            const label = document.createElement('label');
            const box = document.createElement('input');
            box.type = 'checkbox';
            box.value = tab.getAttribute('href');
            label.append(box, tab.textContent.trim());
            options.append(label);
        });
        options.addEventListener('change', () => {
            const selected = Array.from(options.querySelectorAll('input:checked'), box => box.value);
            tabs.forEach(tab => { tab.hidden = !selected.includes(tab.getAttribute('href')); });
            try { localStorage.setItem(preferenceKey(), JSON.stringify(selected)); }
            catch { window.alert('Se han aplicado las pestañas, pero el navegador no ha podido guardarlas.'); }
        });
        panel.addEventListener('beforetoggle', event => {
            if (event.newState === 'open') {
                refresh();
                panel.style.top = button.getBoundingClientRect().bottom + 5 + 'px';
            }
        });
        refresh();
        window.auth?.onAuthStateChanged?.(refresh);
    }

    function decorate(nav) {
        if (document.querySelectorAll) {
            document.querySelectorAll('#hotelSelector, #hotelSelectorNav').forEach(sel => { sel.value = savedHotel(); });
        }
        const page = window.location.pathname.split('/').pop() || 'index.html';
        function showNavUnsavedModal(targetHref) {
            let existing = document.getElementById('navUnsavedModal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'navUnsavedModal';
            modal.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; background:rgba(15, 23, 42, 0.75); backdrop-filter:blur(4px); z-index:99999999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;';

            modal.innerHTML = `
                <div style="background:var(--bg-surface, #ffffff); color:var(--text-main, #0f172a); max-width:440px; width:100%; border-radius:16px; padding:24px; box-shadow:0 25px 50px -12px rgba(0,0,0,0.4); border:1px solid var(--border, #e2e8f0); font-family:system-ui, -apple-system, sans-serif; text-align:center;">
                    <div style="width:54px; height:54px; border-radius:50%; background:rgba(79, 70, 229, 0.15); color:#6366f1; display:flex; align-items:center; justify-content:center; font-size:1.8rem; margin:0 auto 14px auto;">
                        💾
                    </div>
                    <h3 style="margin:0 0 8px 0; font-size:1.15rem; font-weight:800; color:var(--text-main, #1e293b);">
                        ¿Guardar cambios de tarifas?
                    </h3>
                    <p style="margin:0 0 20px 0; font-size:0.88rem; color:var(--text-muted, #64748b); line-height:1.5;">
                        Tienes tarifas simuladas o modificadas sin guardar. ¿Deseas guardarlas antes de cambiar de sección?
                    </p>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button id="navModalSaveBtn" style="background:#4f46e5; color:#ffffff; font-weight:700; border:none; padding:12px 18px; border-radius:10px; cursor:pointer; font-size:0.9rem; display:flex; align-items:center; justify-content:center; gap:8px; box-shadow:0 4px 12px rgba(79,70,229,0.35);">
                            <span>💾</span> Guardar y continuar
                        </button>
                        <button id="navModalDiscardBtn" style="background:rgba(239,68,68,0.1); color:#ef4444; font-weight:700; border:1px solid rgba(239,68,68,0.25); padding:10px 18px; border-radius:10px; cursor:pointer; font-size:0.86rem; display:flex; align-items:center; justify-content:center; gap:6px;">
                            <span>⚠️</span> Salir sin guardar
                        </button>
                        <button id="navModalCancelBtn" style="background:transparent; color:var(--text-muted, #64748b); font-weight:600; border:none; padding:8px 18px; border-radius:10px; cursor:pointer; font-size:0.84rem;">
                            Cancelar y permanecer aquí
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            modal.querySelector('#navModalSaveBtn').onclick = () => {
                if (typeof window.saveManualPrices === 'function') {
                    try {
                        window.saveManualPrices(true);
                    } catch (err) {
                        console.error('Error guardando tarifas al navegar:', err);
                    }
                }
                window.manualPricesPending = false;
                modal.remove();
                window.location.href = targetHref;
            };

            modal.querySelector('#navModalDiscardBtn').onclick = () => {
                window.manualPricesPending = false;
                modal.remove();
                window.location.href = targetHref;
            };

            modal.querySelector('#navModalCancelBtn').onclick = () => {
                modal.remove();
            };
        }

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

        if (links) addModuleMenu(nav, links, page);
        nav.querySelectorAll('.nav-links a, .module-list a').forEach(a => {
            a.classList.toggle('active', a.getAttribute('href') === page);
            a.addEventListener('click', (e) => {
                const targetHref = a.getAttribute('href');
                if (!targetHref || targetHref === page || targetHref.startsWith('#')) return;
                if (window.manualPricesPending) {
                    e.preventDefault();
                    showNavUnsavedModal(targetHref);
                    return;
                }
                const heavyTable = document.getElementById('tableBody');
                if (heavyTable) heavyTable.textContent = '';
            });
        });
        renderNexusUserWidget();
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
        if (typeof document !== 'undefined' && document.body && document.body.style) {
            document.body.style.paddingTop = nav.style && nav.style.display === 'none' ? '0px' : '60px';
        }
        const userChip = nav.querySelector && (nav.querySelector('.user-chip') || nav.querySelector('.nav-user'));
        if (userChip && !nav.querySelector('.app-version-badge, [data-version-badge]') && document.createElement) {
            const badge = document.createElement('div');
            badge.className = 'app-version-badge';
            badge.style.cssText = 'padding:2px 8px; font-size:0.72rem;';
            if (userChip.prepend) userChip.prepend(badge);
            else if (userChip.insertBefore) userChip.insertBefore(badge, userChip.firstChild);
        }
        if (window.CAPASUITE_VERSION && nav.querySelectorAll) {
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
