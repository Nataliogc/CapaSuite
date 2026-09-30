"""Script para inyectar el código PWA en index.html antes de </body>"""

pwa_code = '''
    <!-- Banner de instalacion PWA -->
    <div id="pwa-install-banner" style="
        display: none;
        position: fixed;
        bottom: 1.5rem;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #6366f1, #4f46e5);
        color: #fff;
        padding: 0.85rem 1.5rem;
        border-radius: 50px;
        box-shadow: 0 8px 32px rgba(99,102,241,0.45);
        align-items: center;
        gap: 1rem;
        z-index: 9999;
        font-family: 'Inter', sans-serif;
        font-size: 0.9rem;
        font-weight: 500;
        white-space: nowrap;
        animation: slideUp 0.4s cubic-bezier(0.4,0,0.2,1);
    ">
        <span>&#128242; Instalar CapaSuite como app</span>
        <button id="pwa-install-btn" style="
            background: #fff;
            color: #4f46e5;
            border: none;
            padding: 0.4rem 1rem;
            border-radius: 50px;
            cursor: pointer;
            font-weight: 700;
            font-size: 0.85rem;
        ">Instalar</button>
        <button id="pwa-dismiss-btn" style="
            background: transparent;
            color: rgba(255,255,255,0.7);
            border: none;
            cursor: pointer;
            font-size: 1.1rem;
            line-height: 1;
            padding: 0;
        " title="Cerrar">&#x2715;</button>
    </div>

    <style>
        @keyframes slideUp {
            from { opacity: 0; transform: translateX(-50%) translateY(20px); }
            to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
    </style>

    <!-- Registro del Service Worker + logica de instalacion PWA -->
    <script>
        (function () {
            if ('serviceWorker' in navigator) {
                window.addEventListener('load', () => {
                    navigator.serviceWorker
                        .register('/service-worker.js')
                        .then((reg) => {
                            console.log('[PWA] Service Worker registrado:', reg.scope);
                            reg.addEventListener('updatefound', () => {
                                const newWorker = reg.installing;
                                newWorker.addEventListener('statechange', () => {
                                    if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                        console.log('[PWA] Nueva version disponible. Recarga para actualizar.');
                                    }
                                });
                            });
                        })
                        .catch((err) => console.warn('[PWA] Error al registrar SW:', err));
                });
            }

            let deferredPrompt = null;
            const banner = document.getElementById('pwa-install-banner');
            const installBtn = document.getElementById('pwa-install-btn');
            const dismissBtn = document.getElementById('pwa-dismiss-btn');
            const DISMISSED_KEY = 'pwa_banner_dismissed';

            window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                deferredPrompt = e;
                if (!sessionStorage.getItem(DISMISSED_KEY)) {
                    setTimeout(() => { banner.style.display = 'flex'; }, 3000);
                }
            });

            if (installBtn) {
                installBtn.addEventListener('click', async () => {
                    if (!deferredPrompt) return;
                    banner.style.display = 'none';
                    deferredPrompt.prompt();
                    const { outcome } = await deferredPrompt.userChoice;
                    console.log('[PWA] Respuesta del usuario:', outcome);
                    deferredPrompt = null;
                });
            }

            if (dismissBtn) {
                dismissBtn.addEventListener('click', () => {
                    banner.style.display = 'none';
                    sessionStorage.setItem(DISMISSED_KEY, '1');
                });
            }

            window.addEventListener('appinstalled', () => {
                banner.style.display = 'none';
                deferredPrompt = null;
                console.log('[PWA] App instalada correctamente.');
            });
        })();
    </script>

'''

with open('index.html', 'r', encoding='utf-8') as f:
    content = f.read()

new_content = content.replace('</body>', pwa_code + '</body>', 1)

if new_content == content:
    print('ERROR: </body> not found')
else:
    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('OK: PWA scripts injected successfully')
