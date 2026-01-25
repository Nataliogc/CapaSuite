
// CapaSuite Firebase Auth & Sync
// Este archivo maneja la conexión con la nube para sincronizar datos entre dispositivos

const firebaseConfig = {
    apiKey: "AIzaSyCBa1EEt-9wK7zHoz6c_ZSrB9ZsbX0qCtM",
    authDomain: "capasuite.firebaseapp.com",
    projectId: "capasuite",
    storageBucket: "capasuite.firebasestorage.app",
    messagingSenderId: "1066499289752",
    appId: "1:1066499289752:web:3b2edef8bdec54c52c56ed"
};

// Inicializar Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const db = firebase.database();
const auth = firebase.auth();

// Claves de base de datos
const DB_KEY = "hotel_manager_db_v2";
const CONFIG_KEY = "hotel_manager_config_v2";

/**
 * Función para proteger las páginas
 */
function checkAuth() {
    return new Promise((resolve) => {
        auth.onAuthStateChanged(async (user) => {
            const currentPath = window.location.pathname;
            const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === "";

            if (!user) {
                if (!isHome) {
                    window.location.href = 'index.html';
                }
                resolve(null);
            } else {
                console.log("👤 CapaSuite: Usuario identificado como " + user.email);
                // Si acabamos de entrar, descargar datos
                if (!window._initialDownloadDone) {
                    window._initialDownloadDone = true;
                    await downloadFromCloud();
                    // Refrescar página si hay funciones de renderizado
                    if (typeof render === 'function') render();
                    if (typeof updateAll === 'function') updateAll();
                    if (typeof init === 'function') init();
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
    const user = auth.currentUser;
    if (!user) return;

    const data = CapaStorage.getItem(DB_KEY);
    const config = CapaStorage.getItem(CONFIG_KEY);

    if (!data) return;

    try {
        await db.ref('users/' + user.uid).update({
            hotelData: data,
            configData: config,
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
    const user = auth.currentUser;
    if (!user) return false;

    try {
        const snapshot = await db.ref('users/' + user.uid).once('value');
        if (snapshot.exists()) {
            const cloudData = snapshot.val();
            let hasNewData = false;

            if (cloudData.hotelData) {
                CapaStorage.setItem(DB_KEY, cloudData.hotelData);
                hasNewData = true;
            }
            if (cloudData.configData) {
                CapaStorage.setItem(CONFIG_KEY, cloudData.configData);
                hasNewData = true;
            }

            if (hasNewData) {
                console.log("☁️ CapaSuite: Datos recuperados de la nube.");
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
    if (!auth.currentUser) {
        alert("Primero debes iniciar sesión.");
        return;
    }
    await uploadToCloud();
    alert("📤 Tus datos locales han sido subidos a Firebase con éxito.");
};

// Interceptar CapaStorage para auto-sincronizar cuando el usuario está logueado
const originalSetItem = CapaStorage.setItem;
CapaStorage.setItem = function (key, value) {
    originalSetItem(key, value);
    if (auth.currentUser && (key === DB_KEY || key === CONFIG_KEY)) {
        // Debounce simple para no saturar Firebase
        if (window._syncTimer) clearTimeout(window._syncTimer);
        window._syncTimer = setTimeout(uploadToCloud, 2000);
    }
};
