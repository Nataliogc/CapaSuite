"""
Inyecta en CargarDatos.html:
1. Banner "Carpeta de trabajo" con acceso directo a la carpeta guardada (File System Access API)
2. Lógica JS para guardar/recuperar el directorio handle en IndexedDB
"""

BANNER_HTML = '''
        <!-- ===== CARPETA FAVORITA (File System Access API) ===== -->
        <div id="fav-folder-bar" style="
            margin-bottom: 16px;
            padding: 10px 18px;
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 14px;
            display: flex;
            align-items: center;
            gap: 12px;
            font-size: 0.85rem;
        ">
            <span style="font-size: 1.3rem;">📁</span>
            <div style="flex:1; min-width:0;">
                <div style="font-weight:600; color:var(--text-main);">Carpeta de trabajo</div>
                <div id="fav-folder-name" style="
                    color:var(--text-muted);
                    font-size:0.78rem;
                    white-space:nowrap;
                    overflow:hidden;
                    text-overflow:ellipsis;
                ">Sin carpeta guardada</div>
            </div>
            <button id="fav-folder-open-btn" onclick="openFromFavFolder()" style="
                display:none;
                background: var(--primary);
                color:#fff;
                border:none;
                padding:6px 14px;
                border-radius:8px;
                cursor:pointer;
                font-size:0.8rem;
                font-weight:600;
                white-space:nowrap;
            ">Abrir archivo aquí</button>
            <button onclick="pickFavFolder()" style="
                background: transparent;
                color: var(--text-muted);
                border: 1px solid var(--border);
                padding:6px 12px;
                border-radius:8px;
                cursor:pointer;
                font-size:0.78rem;
                white-space:nowrap;
            " title="Cambiar carpeta guardada">&#128393; Cambiar</button>
        </div>

        <script>
        // ── Carpeta Favorita (File System Access API + IndexedDB) ──────────
        (function() {
            const DB_NAME  = 'capasuite_fav';
            const DB_VER   = 1;
            const STORE    = 'handles';
            const KEY      = 'favFolder';

            // Abre (o crea) la base IndexedDB
            function openDB() {
                return new Promise((resolve, reject) => {
                    const req = indexedDB.open(DB_NAME, DB_VER);
                    req.onupgradeneeded = e => e.target.result.createObjectStore(STORE);
                    req.onsuccess = e => resolve(e.target.result);
                    req.onerror   = e => reject(e.target.error);
                });
            }

            async function saveHandle(handle) {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx  = db.transaction(STORE, 'readwrite');
                    tx.objectStore(STORE).put(handle, KEY);
                    tx.oncomplete = resolve;
                    tx.onerror    = e => reject(e.target.error);
                });
            }

            async function loadHandle() {
                const db = await openDB();
                return new Promise((resolve, reject) => {
                    const tx  = db.transaction(STORE, 'readonly');
                    const req = tx.objectStore(STORE).get(KEY);
                    req.onsuccess = e => resolve(e.target.result || null);
                    req.onerror   = e => reject(e.target.error);
                });
            }

            function updateUI(name) {
                const nameEl   = document.getElementById('fav-folder-name');
                const openBtn  = document.getElementById('fav-folder-open-btn');
                if (name) {
                    nameEl.textContent  = name;
                    nameEl.style.color  = 'var(--primary)';
                    openBtn.style.display = 'inline-block';
                } else {
                    nameEl.textContent  = 'Sin carpeta guardada';
                    nameEl.style.color  = 'var(--text-muted)';
                    openBtn.style.display = 'none';
                }
            }

            // Seleccionar y guardar carpeta favorita
            window.pickFavFolder = async function() {
                if (!('showDirectoryPicker' in window)) {
                    alert('Tu navegador no soporta la selección de carpetas. Usa Chrome o Edge.');
                    return;
                }
                try {
                    const handle = await window.showDirectoryPicker({ mode: 'read' });
                    await saveHandle(handle);
                    window._favFolderHandle = handle;
                    updateUI(handle.name);
                } catch (e) {
                    if (e.name !== 'AbortError') console.warn('[FavFolder]', e);
                }
            };

            // Abrir un archivo dentro de la carpeta guardada
            window.openFromFavFolder = async function() {
                const handle = window._favFolderHandle;
                if (!handle) return;

                // Re-pedir permiso si expiró
                const perm = await handle.requestPermission({ mode: 'read' });
                if (perm !== 'granted') {
                    updateUI(null);
                    return;
                }

                // Listar archivos .xlsx / .xls en la carpeta
                const files = [];
                for await (const [name, fh] of handle.entries()) {
                    if (fh.kind === 'file' && /\\.xlsx?$/i.test(name)) {
                        files.push({ name, fh });
                    }
                }

                if (files.length === 0) {
                    alert('No se encontraron archivos Excel (.xlsx / .xls) en esa carpeta.');
                    return;
                }

                // Mostrar selector rápido
                showFolderFilePicker(files);
            };

            // Selector rápido de archivo dentro de la carpeta
            function showFolderFilePicker(files) {
                // Reutiliza el modal existente si hay uno, o crea uno inline
                let modal = document.getElementById('fav-file-modal');
                if (!modal) {
                    modal = document.createElement('div');
                    modal.id = 'fav-file-modal';
                    modal.style.cssText = `
                        position:fixed; inset:0; background:rgba(0,0,0,0.6);
                        display:flex; align-items:center; justify-content:center;
                        z-index:99999; font-family:'Outfit',sans-serif;
                    `;
                    document.body.appendChild(modal);
                }

                // Ordenar por fecha de modificación desc si está disponible, sino alfabético
                files.sort((a, b) => a.name.localeCompare(b.name));

                modal.innerHTML = `
                    <div style="
                        background:var(--bg-surface,#1e293b);
                        border-radius:20px;
                        padding:28px;
                        width:min(520px,90vw);
                        max-height:70vh;
                        overflow-y:auto;
                        box-shadow:0 20px 60px rgba(0,0,0,0.5);
                    ">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;">
                            <h3 style="color:var(--text-main,#f1f5f9);margin:0;">📂 Elige un archivo</h3>
                            <button onclick="document.getElementById('fav-file-modal').style.display='none'"
                                style="background:transparent;border:none;color:var(--text-muted,#94a3b8);font-size:1.4rem;cursor:pointer;">&#x2715;</button>
                        </div>
                        <div style="display:flex;flex-direction:column;gap:8px;">
                            ${files.map((f, i) => `
                                <button data-idx="${i}" onclick="window._favPickFile(${i})" style="
                                    text-align:left;
                                    background:var(--bg-glass,rgba(30,41,59,0.7));
                                    border:1px solid var(--border,rgba(255,255,255,0.1));
                                    border-radius:10px;
                                    padding:10px 14px;
                                    color:var(--text-main,#f1f5f9);
                                    font-size:0.85rem;
                                    cursor:pointer;
                                    transition:background 0.2s;
                                ">📄 ${f.name}</button>
                            `).join('')}
                        </div>
                    </div>
                `;
                modal.style.display = 'flex';

                window._favPickFile = async function(i) {
                    modal.style.display = 'none';
                    const { fh } = files[i];
                    const file = await fh.getFile();
                    // Reutiliza el handler ya existente en la app
                    if (typeof handleFile === 'function') {
                        handleFile(file, null);
                    }
                };
            }

            // Al cargar: restaurar carpeta guardada
            async function init() {
                if (!('showDirectoryPicker' in window)) {
                    document.getElementById('fav-folder-bar').style.display = 'none';
                    return;
                }
                try {
                    const handle = await loadHandle();
                    if (handle) {
                        // Verificar que el permiso sigue vigente (sin prompt)
                        const perm = await handle.queryPermission({ mode: 'read' });
                        window._favFolderHandle = handle;
                        if (perm === 'granted') {
                            updateUI(handle.name);
                        } else {
                            // Permiso expirado — mostrar nombre de todas formas pero sin el botón aún
                            updateUI(handle.name + ' (clic para reactivar)');
                        }
                    }
                } catch (e) {
                    console.warn('[FavFolder] init error:', e);
                }
            }

            init();
        })();
        </script>
        <!-- ===== FIN CARPETA FAVORITA ===== -->
'''

# Insertar el banner justo antes de <!-- SMART UNIVERSAL DROP ZONE -->
ANCHOR = '        <!-- SMART UNIVERSAL DROP ZONE -->'

with open('CargarDatos.html', 'r', encoding='utf-8') as f:
    content = f.read()

if ANCHOR not in content:
    print('ERROR: anchor not found')
else:
    new_content = content.replace(ANCHOR, BANNER_HTML + '\n' + ANCHOR, 1)
    with open('CargarDatos.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('OK: Carpeta favorita inyectada correctamente')
