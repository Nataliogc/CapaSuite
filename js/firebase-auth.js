
// CapaSuite Firebase Auth & Sync
// Este archivo maneja la conexión con la nube para sincronizar datos entre dispositivos


// Configuración de Firebase - Ahora se carga desde un archivo externo ignorado por git: firebase-config-env.js
// Usamos una variable local con nombre distinto o simplemente accedemos a la global
const _firebaseConfig = window.capasuite_firebase_config || {
    apiKey: "TU_API_KEY_AQUI", // REEMPLAZAR EN js/firebase-config-env.js
    authDomain: "capasuite.firebaseapp.com",
    databaseURL: "https://capasuite-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "capasuite",
    storageBucket: "capasuite.firebasestorage.app",
    messagingSenderId: "1066499289752",
    appId: "1:1066499289752:web:3b2edef8bdec54c52c56ed"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(_firebaseConfig);
}

const cloudDb = firebase.database();
const cloudAuth = firebase.auth();

const SYNC_DB_KEY = "hotel_manager_db_v2";
const SYNC_CONFIG_KEY = "upload_config_db_v2";
const SYNC_COMP_KEY = "revenue_data_v2";

// MODO LOCAL: Saltarse login si estamos en localhost
const _h = window.location.hostname;
const _isLocalBypass = (_h === 'localhost' || _h === '127.0.0.1' || _h === '::1' || _h === '' || window.location.protocol === 'file:') && !localStorage.getItem('force_login_once');

if (_isLocalBypass) {
    console.log("🚀 MODO LOCAL detectado. Bypass activo.");
    window._capasuite_local_mode = true;
}

/**
 * Función para proteger las páginas
 */
function checkAuth() {
    return new Promise((resolve) => {
        // En modo local, resolvemos inmediatamente sin esperar a Firebase
        if (_isLocalBypass) {
            // Actualizar UI de nav global si existe (cuando cargue el DOM)
            document.addEventListener('DOMContentLoaded', () => {
                const navEmail = document.getElementById('userEmailNav');
                if (navEmail) {
                    navEmail.innerHTML = '<span style="color:#ef4444; font-weight:800; cursor:pointer;" onclick="localStorage.setItem(\'force_login_once\', \'true\'); location.reload()">🚀 MODO LOCAL (Inicia Sesión para Nube)</span>';
                }
            });
            resolve({ email: 'Local Mode', uid: 'local', isLocal: true });
            return;
        }

        cloudAuth.onAuthStateChanged(async (user) => {
            const currentPath = window.location.pathname;
            const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === "";

            if (!user) {
                if (!isHome) {
                    window.location.href = 'index.html';
                }
                resolve(null);
            } else {
                console.log("👤 CapaSuite: Usuario identificado como " + user.email);

                // Actualizar email en la barra de navegación si existe el elemento
                const navEmail = document.getElementById('userEmailNav');
                if (navEmail) {
                    let displayEmail = user.email;
                    if (displayEmail === 'admin@capasuite.com') displayEmail = 'Administrador CapaSuite';
                    navEmail.innerText = displayEmail;
                }

                // Si acabamos de entrar, descargar datos
                if (!window._initialDownloadDone) {
                    window._initialDownloadDone = true;
                    await downloadFromCloud();
                    // Refrescar página si hay funciones de renderizado
                    const globalUpdate = window.updateAll || window.renderAll || window.render || window.init || window.initView;
                    if (typeof globalUpdate === 'function') globalUpdate();
                }
                resolve(user);
            }
        });
    });
}

// Ejecutar protección al cargar
window.addEventListener('load', checkAuth);

/**
 * Sincroniza LocalStorage -> Firebase
 */
async function uploadToCloud() {
    const user = cloudAuth.currentUser;
    if (!user) return;

    const data = CapaStorage.getItem(SYNC_DB_KEY);
    const config = CapaStorage.getItem(SYNC_CONFIG_KEY);
    const comp = CapaStorage.getItem(SYNC_COMP_KEY);

    try {
        await cloudDb.ref('users/' + user.uid).update({
            hotelData: data,
            configData: config,
            compData: comp,
            lastSync: firebase.database.ServerValue.TIMESTAMP
        });
        console.log("☁️ CapaSuite: Datos sincronizados con la nube (Realtime).");
    } catch (error) {
        console.error("❌ Error sincronizando con Firebase:", error);
    }
}

/**
 * Sincroniza Firebase -> LocalStorage
 */
async function downloadFromCloud() {
    const user = cloudAuth.currentUser;
    if (!user) return false;

    try {
        const snapshot = await cloudDb.ref('users/' + user.uid).once('value');
        if (snapshot.exists()) {
            const cloudData = snapshot.val();
            let hasNewData = false;

            if (cloudData.hotelData) {
                CapaStorage.setItem(SYNC_DB_KEY, cloudData.hotelData);
                hasNewData = true;
            }
            if (cloudData.configData) {
                CapaStorage.setItem(SYNC_CONFIG_KEY, cloudData.configData);
                hasNewData = true;
            }
            if (cloudData.compData) {
                CapaStorage.setItem(SYNC_COMP_KEY, cloudData.compData);
                hasNewData = true;
            }

            if (hasNewData) {
                console.log("☁️ CapaSuite: Datos recuperados de la nube.");
                // Disparar evento para que las páginas recarguen sus variables locales
                window.dispatchEvent(new CustomEvent('capasuite-data-synced'));
                return true;
            }
        }
    } catch (error) {
        console.error("❌ Error recuperando de Firebase:", error);
    }
    return false;
}

// Función global para forzar subida técnica
window.forceCloudUpload = async function () {
    if (!cloudAuth.currentUser) {
        alert("Primero debes iniciar sesión.");
        return;
    }
    await uploadToCloud();
    alert("📤 Tus datos locales han sido subidos a Firebase con éxito.");
};

// Interceptar CapaStorage para auto-sincronizar cuando el usuario está logueado
const originalSetItem = CapaStorage.setItem;
const originalRemoveItem = CapaStorage.removeItem;

CapaStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (cloudAuth.currentUser && (key === SYNC_DB_KEY || key === SYNC_CONFIG_KEY || key === SYNC_COMP_KEY)) {
        if (window._syncTimer) clearTimeout(window._syncTimer);
        window._syncTimer = setTimeout(uploadToCloud, 1000); // 1s para cambios normales
    }
};

CapaStorage.removeItem = function (key) {
    originalRemoveItem(key);
    if (cloudAuth.currentUser && (key === SYNC_DB_KEY || key === SYNC_CONFIG_KEY || key === SYNC_COMP_KEY)) {
        // Para borrar, somos más agresivos
        if (window._syncTimer) clearTimeout(window._syncTimer);
        uploadToCloud(); // Sincronización inmediata para borrar
    }
};

// Asegurar sincronización antes de cerrar la página
window.addEventListener('beforeunload', () => {
    if (window._syncTimer) {
        clearTimeout(window._syncTimer);
        uploadToCloud();
    }
});

window.auth = cloudAuth;
