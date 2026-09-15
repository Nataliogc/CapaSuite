// CapaSuite Firebase Auth & Sync
// Este archivo maneja la conexión con la nube para sincronizar datos entre dispositivos

// Configuración de Firebase - Fallback para la versión en GitHub Pages
// NOTA: Es MUY importante restringir esta clave por HTTP Referrer en la consola de Google Cloud (GCP)
const _firebaseConfig = window.capasuite_firebase_config || {
    apiKey: "AIzaSyCBa1EEt-9wK7zHoz6c_ZSrB9ZsbX0qCtM", 
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

// Exportar globalmente para que todas las páginas lo vean como 'auth' y 'db'
window.db = firebase.database();
window.auth = firebase.auth();

const cloudDb = window.db;
const cloudAuth = window.auth;

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
                    const downloaded = await downloadFromCloud();
                    if (!downloaded) { resolve(user); return; }
                    window._initialDownloadDone = true;
                    startCloudListener(user.uid);
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

// Only changes made in this tab are sent. Remote downloads never become writes.
const syncFields = {
    [SYNC_DB_KEY]: 'hotelData',
    [SYNC_CONFIG_KEY]: 'configData',
    [SYNC_COMP_KEY]: 'compData'
};
const originalSetItem = CapaStorage.setItem.bind(CapaStorage);
const originalRemoveItem = CapaStorage.removeItem.bind(CapaStorage);
const pendingChanges = new Map();
let applyingCloud = false;
let uploadInFlight = null;
let cloudListener = null;
let cloudListenerUid = null;

function syncStatus(message, failed = false) {
    let status = document.getElementById('capasuiteSyncStatus');
    const anchor = document.getElementById('userEmailNav');
    if (!status && anchor && anchor.parentNode) {
        status = document.createElement('span');
        status.id = 'capasuiteSyncStatus';
        status.style.cssText = 'font-size:11px;margin-left:8px;';
        status.setAttribute('role', 'status');
        anchor.parentNode.insertBefore(status, anchor.nextSibling);
    }
    if (status) {
        status.textContent = message;
        status.style.color = failed ? '#dc2626' : '#64748b';
    }
}

const sameValue = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function parseSyncValue(value) {
    if (value == null) return null;
    return JSON.parse(value);
}

// Three-way merge: unchanged local values cannot erase newer remote values.
function mergeSyncChanges(base, local, remote) {
    if (sameValue(base, local)) return remote;
    if (isRecord(local) && (isRecord(base) || base == null)) {
        const merged = isRecord(remote) ? { ...remote } : {};
        for (const key of new Set([...Object.keys(base || {}), ...Object.keys(local)])) {
            if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
            if (!Object.hasOwn(local, key)) {
                if (base && Object.hasOwn(base, key)) delete merged[key];
            } else {
                const value = mergeSyncChanges(base?.[key], local[key], merged[key]);
                if (value === undefined) delete merged[key];
                else merged[key] = value;
            }
        }
        return merged;
    }
    if (Array.isArray(base) && Array.isArray(local) && base.length === local.length && Array.isArray(remote) && remote.length === local.length) {
        return local.map((value, index) => mergeSyncChanges(base[index], value, remote[index]));
    }
    return local;
}

function writeLocalSyncValue(key, value) {
    if (value == null) originalRemoveItem(key);
    else originalSetItem(key, JSON.stringify(value));
}

function applyCloudData(cloudData) {
    applyingCloud = true;
    try {
        for (const [key, field] of Object.entries(syncFields)) {
            // An absent cloud account is not permission to delete local data.
            if (!Object.hasOwn(cloudData, field)) continue;
            const remote = parseSyncValue(cloudData[field]);
            const pending = pendingChanges.get(key);
            const local = parseSyncValue(CapaStorage.getItem(key));
            const merged = pending ? mergeSyncChanges(pending.base, local, remote) : remote;
            writeLocalSyncValue(key, merged);
            if (pending) pending.base = remote;
        }
        window.dispatchEvent(new CustomEvent('capasuite-data-synced'));
    } finally {
        applyingCloud = false;
    }
}

function scheduleCloudUpload() {
    if (window._syncTimer) clearTimeout(window._syncTimer);
    window._syncTimer = null;
    if (!pendingChanges.size || !cloudAuth.currentUser || !window._initialDownloadDone) return;
    window._syncTimer = setTimeout(() => {
        window._syncTimer = null;
        uploadToCloud().catch(error => console.error('Error guardando cambios en la nube:', error));
    }, 1000);
}

async function uploadToCloud() {
    if (uploadInFlight) return uploadInFlight;
    const user = cloudAuth.currentUser;
    if (!user) throw new Error('Primero debes iniciar sesión.');
    if (!window._initialDownloadDone && !(await downloadFromCloud())) throw new Error('No se ha podido descargar la versión actual de la nube.');
    if (!pendingChanges.size) return true;
    if (window._syncTimer) clearTimeout(window._syncTimer);
    window._syncTimer = null;
    const changes = [...pendingChanges].map(([key, change]) => ({ key, base: change.base, version: change.version, local: parseSyncValue(CapaStorage.getItem(key)) }));
    syncStatus('Guardando cambios…');
    uploadInFlight = (async () => {
        try {
            const result = await cloudDb.ref('users/' + user.uid).transaction(current => {
                const next = { ...(current || {}) };
                for (const change of changes) {
                    const field = syncFields[change.key];
                    const merged = mergeSyncChanges(change.base, change.local, parseSyncValue(next[field]));
                    next[field] = merged == null ? null : JSON.stringify(merged);
                }
                next.lastSync = firebase.database.ServerValue.TIMESTAMP;
                return next;
            }, undefined, false);
            if (!result.committed) throw new Error('El servidor no confirmó el guardado.');
            const committed = result.snapshot.val() || {};
            for (const change of changes) {
                const pending = pendingChanges.get(change.key);
                if (pending?.version === change.version) pendingChanges.delete(change.key);
                else if (pending) pending.base = change.local;
                // Firebase omits fields deleted with null; propagate explicit deletions locally.
                if (!Object.hasOwn(committed, syncFields[change.key])) committed[syncFields[change.key]] = null;
            }
            applyCloudData(committed);
            syncStatus('Guardado en la nube');
            console.log('☁️ CapaSuite: cambios confirmados por Firebase.');
            return true;
        } catch (error) {
            syncStatus('Error al guardar en la nube. Cambios pendientes.', true);
            throw error;
        } finally {
            uploadInFlight = null;
        }
    })();
    const result = await uploadInFlight;
    if (pendingChanges.size) scheduleCloudUpload();
    return result;
}

async function downloadFromCloud() {
    const user = cloudAuth.currentUser;
    if (!user) return false;
    syncStatus('Descargando datos…');
    try {
        const snapshot = await cloudDb.ref('users/' + user.uid).once('value');
        applyCloudData(snapshot.val() || {});
        window._initialDownloadDone = true;
        syncStatus('Datos descargados de la nube');
        console.log('☁️ CapaSuite: descarga de la nube completada.');
        scheduleCloudUpload();
        return true;
    } catch (error) {
        syncStatus('No se pudo descargar la nube. Mostrando copia local.', true);
        console.error('Error recuperando datos de Firebase:', error);
        return false;
    }
}

function startCloudListener(uid) {
    if (cloudListenerUid === uid) return;
    if (cloudListener) cloudDb.ref('users/' + cloudListenerUid).off('value', cloudListener);
    cloudListenerUid = uid;
    cloudListener = snapshot => {
        if (uploadInFlight) return;
        try {
            applyCloudData(snapshot.val() || {});
            syncStatus(pendingChanges.size ? 'Cambios pendientes de guardar' : 'Sincronizado con la nube');
        } catch (error) {
            syncStatus('No se pudo actualizar desde la nube.', true);
            console.error(error);
        }
    };
    cloudDb.ref('users/' + uid).on('value', cloudListener, error => {
        syncStatus('Sin conexión con la nube.', true);
        console.error(error);
    });
}

function recordSyncChange(key, before, after) {
    if (applyingCloud || !syncFields[key] || before === after) return;
    const existing = pendingChanges.get(key);
    pendingChanges.set(key, { base: existing ? existing.base : parseSyncValue(before), version: (existing?.version || 0) + 1 });
    scheduleCloudUpload();
}

function readLocalWithoutEcho(key) {
    const previous = applyingCloud;
    applyingCloud = true;
    try { return CapaStorage.getItem(key); }
    finally { applyingCloud = previous; }
}

CapaStorage.setItem = function (key, value) {
    if (applyingCloud) { originalSetItem(key, value); return; }
    const before = syncFields[key] ? readLocalWithoutEcho(key) : null;
    originalSetItem(key, value);
    recordSyncChange(key, before, value);
};
CapaStorage.removeItem = function (key) {
    if (applyingCloud) { originalRemoveItem(key); return; }
    const before = syncFields[key] ? readLocalWithoutEcho(key) : null;
    originalRemoveItem(key);
    recordSyncChange(key, before, null);
};

window.forceCloudUpload = async function () {
    try {
        await uploadToCloud();
        // A fresh server read, not the local write result, supplies the confirmation.
        const snapshot = await cloudDb.ref('users/' + cloudAuth.currentUser.uid).once('value');
        const saved = snapshot.val() || {};
        const hotels = parseSyncValue(saved.hotelData) || {};
        const years = Object.keys(hotels.Guadiana || {}).filter(y => /^\d{4}$/.test(y)).sort();
        alert('Nube verificada. Años de Guadiana guardados: ' + (years.join(', ') || 'sin datos'));
    } catch (error) {
        syncStatus('No se pudo verificar el guardado.', true);
        alert('No se ha confirmado el guardado en la nube: ' + error.message);
    }
};

window.addEventListener('beforeunload', event => {
    if (pendingChanges.size || uploadInFlight) {
        // Do not initiate an unreliable full-database write while closing a tab.
        event.preventDefault();
        event.returnValue = '';
    }
});
window.auth = cloudAuth;
