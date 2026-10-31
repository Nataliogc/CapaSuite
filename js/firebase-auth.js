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

/// Nombres amigables para los usuarios de CapaSuite
const USER_DISPLAY_NAMES = {
    'dianahotelguadiana@gmail.com': 'Diana',
    'ssanchez@hotelguadiana.es': 'Sergio',
    'osanchez@hotelguadiana.es': 'Oscar',
    'comunicaciones@hotelguadiana.es': 'Natalio',
    'admin@capasuite.com': 'Administrador CapaSuite'
};

function getUserDisplayName(user) {
    if (!user) return 'Usuario';
    const email = (typeof user === 'string' ? user : (user.email || '')).toLowerCase().trim();
    if (USER_DISPLAY_NAMES[email]) {
        return USER_DISPLAY_NAMES[email];
    }
    if (typeof user === 'object' && user.displayName) {
        return user.displayName;
    }
    return email || 'Usuario';
}

window.getUserDisplayName = getUserDisplayName;
window.CAPASUITE_USERS = USER_DISPLAY_NAMES;

/**
 * Función para proteger las páginas
 */
function checkAuth() {
    return new Promise((resolve) => {
        // En modo local, resolvemos inmediatamente sin esperar a Firebase
        if (_isLocalBypass) {
            // Actualizar UI de nav global si existe (cuando cargue el DOM)
            const showLocalLabel = () => {
                const navEmail = document.getElementById('userEmailNav');
                if (navEmail) {
                    navEmail.innerHTML = '<span style="color:#ef4444; font-weight:800; cursor:pointer;" onclick="localStorage.setItem(\'force_login_once\', \'true\'); location.reload()">🚀 MODO LOCAL (Inicia Sesión para Nube)</span>';
                }
            };
            // checkAuth runs on 'load', when DOMContentLoaded has usually already fired.
            if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showLocalLabel);
            else showLocalLabel();
            resolve({ email: 'Local Mode', uid: 'local', isLocal: true });
            return;
        }

        cloudAuth.onAuthStateChanged(async (user) => {
            const currentPath = window.location.pathname;
            const isHome = currentPath.endsWith('index.html') || currentPath.endsWith('/') || currentPath === "";

            if (!user) {
                stopCloudListener();
                window._initialDownloadDone = false;
                if (!isHome) {
                    window.location.href = 'index.html';
                }
                resolve(null);
            } else {
                prepareCloudAccount(user.uid);
                console.log("👤 CapaSuite: Usuario identificado como " + user.email);

                // Actualizar nombre de usuario en la barra de navegación si existe el elemento
                const navEmail = document.getElementById('userEmailNav');
                if (navEmail) {
                    navEmail.innerText = getUserDisplayName(user);
                }

                // Si acabamos de entrar, descargar datos
                if (!window._initialDownloadDone) {
                    const downloaded = await downloadFromCloud();
                    if (!downloaded) { scheduleSyncRetry(); resolve(user); return; }
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
    [SYNC_COMP_KEY]: 'compData',
    segment_forecast_v2: 'segmentForecast',
    segment_mappings_Guadiana: 'segmentMappingsGuadiana',
    segment_mappings_Cumbria: 'segmentMappingsCumbria',
    // Configuración que altera los cálculos de varios módulos: debe ser idéntica en todos los dispositivos.
    manual_cupos_v1: 'manualCupos',
    custom_events: 'customEvents',
    custom_segment_mapping_v2: 'customSegmentMapping',
    channel_commissions_Guadiana: 'channelCommissionsGuadiana',
    channel_commissions_Cumbria: 'channelCommissionsCumbria',
    capasuite_room_costs_v1: 'roomCosts',
    capasuite_yield_strategy_v1: 'yieldStrategy',
    capasuite_pricing_matrix_2027_v1: 'pricingMatrix2027',
    capasuite_occ_tiers_jan_feb_v1: 'occTiersJanFeb',
    capasuite_pricing_matrix_master_v2: 'pricingMatrixMasterV2',
    capasuite_occ_tiers_master_v2: 'occTiersMasterV2',
    daily_otb_snapshots_v1: 'otbSnapshots',
    capasuite_pricing_exceptions_v1: 'pricingExceptions'
};
const fieldToSyncKey = Object.fromEntries(Object.entries(syncFields).map(([k, f]) => [f, k]));
const CLIENT_SESSION_ID = 'cs_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);

// Settings that existed only locally before being synced: upload the local copy once if the cloud lacks it.
// If the database rules reject these fields, they are dropped so the core data keeps syncing.
const EXTENDED_SYNC_KEYS = new Set([
    'manual_cupos_v1', 'custom_events', 'custom_segment_mapping_v2',
    'channel_commissions_Guadiana', 'channel_commissions_Cumbria',
    'capasuite_room_costs_v1', 'capasuite_yield_strategy_v1',
    'capasuite_pricing_matrix_2027_v1', 'capasuite_occ_tiers_jan_feb_v1',
    'capasuite_pricing_matrix_master_v2', 'capasuite_occ_tiers_master_v2',
    'daily_otb_snapshots_v1', 'capasuite_pricing_exceptions_v1'
]);
let extendedSyncDisabled = false;
const isSyncedKey = key => Object.hasOwn(syncFields, key) && !(extendedSyncDisabled && EXTENDED_SYNC_KEYS.has(key));
const originalSetItem = CapaStorage.setItem.bind(CapaStorage);
const originalRemoveItem = CapaStorage.removeItem.bind(CapaStorage);
const pendingChanges = new Map();
let applyingCloud = false;
let uploadInFlight = null;
let cloudListener = null;
let cloudListenerUid = null;
let listenerPausedByVisibility = false;
let syncRetryTimer = null;
let syncRetryDelay = 0;

function getLocalFieldVersions(uid) {
    try {
        const raw = CapaStorage.getItem('cloud_field_versions_' + uid);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function saveLocalFieldVersions(uid, versions) {
    try {
        originalSetItem('cloud_field_versions_' + uid, JSON.stringify(versions));
    } catch (e) {
        console.warn('CapaSuite: no se pudieron guardar versiones locales de sincronización', e);
    }
}

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

const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function parseSyncValue(value) {
    if (value == null) return null;
    return typeof value === 'string' ? JSON.parse(value) : value;
}

// Three-way merge: fast recursive merge without redundant JSON.stringify on megabytes of data
function mergeSyncChanges(base, local, remote) {
    if (base === local) return remote;
    if (local == null || base == null || typeof local !== 'object' || typeof base !== 'object') {
        return base === local ? remote : local;
    }
    if (Array.isArray(local)) {
        if (!Array.isArray(base) || !Array.isArray(remote) || base.length !== local.length || remote.length !== local.length) {
            return local;
        }
        return local.map((value, index) => mergeSyncChanges(base[index], value, remote[index]));
    }
    const merged = isRecord(remote) ? { ...remote } : {};
    const keys = new Set([...Object.keys(base), ...Object.keys(local)]);
    for (const key of keys) {
        if (['__proto__', 'prototype', 'constructor'].includes(key)) continue;
        if (!Object.hasOwn(local, key)) {
            if (Object.hasOwn(base, key)) delete merged[key];
        } else {
            const value = mergeSyncChanges(base[key], local[key], merged[key]);
            if (value === undefined) delete merged[key];
            else merged[key] = value;
        }
    }
    return merged;
}

function writeLocalSyncValue(key, value) {
    if (value == null) originalRemoveItem(key);
    else originalSetItem(key, JSON.stringify(value));
}

function applySingleCloudField(field, rawValue) {
    const key = fieldToSyncKey[field];
    if (!key || !isSyncedKey(key)) return null;
    const prev = applyingCloud;
    applyingCloud = true;
    try {
        const pending = pendingChanges.get(key);
        const currentRaw = CapaStorage.getItem(key);
        const serializedValue = rawValue == null ? null : (typeof rawValue === 'string' ? rawValue : JSON.stringify(rawValue));
        if (!pending && serializedValue === currentRaw) return null;
        const remote = parseSyncValue(rawValue);
        const merged = pending ? mergeSyncChanges(pending.base, parseSyncValue(currentRaw), remote) : remote;
        const nextRaw = merged == null ? null : JSON.stringify(merged);
        if (nextRaw !== currentRaw) {
            writeLocalSyncValue(key, merged);
            if (pending) pending.base = remote;
            return key;
        }
        if (pending) pending.base = remote;
        return null;
    } catch (error) {
        console.error("CapaSuite: no se pudo aplicar '" + field + "' desde la nube.", error);
        return null;
    } finally {
        applyingCloud = prev;
    }
}

function applyCloudData(cloudData) {
    const prev = applyingCloud;
    applyingCloud = true;
    const changedKeys = [];
    try {
        for (const [key, field] of Object.entries(syncFields)) {
            if (!isSyncedKey(key) || !Object.hasOwn(cloudData, field)) continue;
            const changed = applySingleCloudField(field, cloudData[field]);
            if (changed) changedKeys.push(changed);
        }
        if (changedKeys.length) {
            window.dispatchEvent(new CustomEvent('capasuite-data-synced', { detail: { keys: changedKeys, source: 'cloud' } }));
        }
    } finally {
        applyingCloud = prev;
    }
    return changedKeys;
}

function seedMissingCloudSettings(cloudData) {
    for (const key of EXTENDED_SYNC_KEYS) {
        if (!isSyncedKey(key) || pendingChanges.has(key) || Object.hasOwn(cloudData, syncFields[key])) continue;
        if (CapaStorage.getItem(key) != null) pendingChanges.set(key, { base: null, version: 1 });
    }
}

function scheduleSyncRetry() {
    if (syncRetryTimer || !cloudAuth.currentUser) return;
    syncRetryDelay = Math.min(syncRetryDelay ? syncRetryDelay * 2 : 5000, 120000);
    syncRetryTimer = setTimeout(async () => {
        syncRetryTimer = null;
        if (!cloudAuth.currentUser) return;
        try {
            if (!window._initialDownloadDone) {
                if (!(await downloadFromCloud())) { scheduleSyncRetry(); return; }
                const globalUpdate = window.updateAll || window.renderAll || window.render || window.init || window.initView;
                if (typeof globalUpdate === 'function') globalUpdate();
            } else if (pendingChanges.size) {
                await uploadToCloud();
            }
            syncRetryDelay = 0;
        } catch (error) {
            console.error('Reintento de sincronización fallido:', error);
            scheduleSyncRetry();
        }
    }, syncRetryDelay);
}

window.addEventListener('online', () => {
    if (syncRetryTimer) { clearTimeout(syncRetryTimer); syncRetryTimer = null; }
    syncRetryDelay = 0;
    if (cloudAuth.currentUser && (!window._initialDownloadDone || pendingChanges.size)) scheduleSyncRetry();
});

function scheduleCloudUpload() {
    if (window._syncTimer) clearTimeout(window._syncTimer);
    window._syncTimer = null;
    if (!pendingChanges.size || !cloudAuth.currentUser || !window._initialDownloadDone) return;
    window._syncTimer = setTimeout(() => {
        window._syncTimer = null;
        uploadToCloud().catch(error => console.error('Error guardando cambios en la nube:', error));
    }, 1000);
}

const FIREBASE_OP_TIMEOUT_MS = 15000;
function withCloudTimeout(promise, opName) {
    let t;
    const timeout = new Promise((_, reject) => {
        t = setTimeout(() => {
            const err = new Error('Tiempo de espera agotado al conectar con Firebase (' + opName + '). Es muy probable que se haya superado la cuota mensual del plan Spark.');
            err.code = 'FIREBASE_TIMEOUT';
            reject(err);
        }, FIREBASE_OP_TIMEOUT_MS);
    });
    return Promise.race([promise, timeout]).finally(() => {
        if (t) clearTimeout(t);
    });
}

async function uploadToCloud() {
    if (uploadInFlight) return uploadInFlight;
    const user = cloudAuth.currentUser;
    if (!user) throw new Error('Primero debes iniciar sesión.');
    prepareCloudAccount(user.uid);
    if (!window._initialDownloadDone && !(await downloadFromCloud())) throw new Error('No se ha podido descargar la versión actual de la nube.');
    if (!pendingChanges.size) return true;
    if (window._syncTimer) clearTimeout(window._syncTimer);
    window._syncTimer = null;
    const changes = [...pendingChanges].map(([key, change]) => ({
        key,
        field: syncFields[key],
        base: change.base,
        version: change.version,
        local: parseSyncValue(CapaStorage.getItem(key))
    }));
    syncStatus('Guardando cambios…');
    uploadInFlight = (async () => {
        try {
            const now = firebase.database.ServerValue.TIMESTAMP;
            const metaUpdates = {
                'lastSync': now,
                '_fieldSync/lastSync': now,
                '_fieldSync/_writer': CLIENT_SESSION_ID
            };

            for (const change of changes) {
                const fieldRef = cloudDb.ref('users/' + user.uid + '/' + change.field);
                const result = await withCloudTimeout(fieldRef.transaction(currentRaw => {
                    const raw = isRecord(currentRaw) && Object.hasOwn(currentRaw, change.field) ? currentRaw[change.field] : currentRaw;
                    const remote = parseSyncValue(raw);
                    const merged = mergeSyncChanges(change.base, change.local, remote);
                    return merged == null ? null : JSON.stringify(merged);
                }, undefined, false), 'guardado_' + change.field);

                if (!result.committed) throw new Error('El servidor no confirmó el guardado de ' + change.field + '.');

                const committedRaw = result.snapshot.val();
                const unwrapped = isRecord(committedRaw) && Object.hasOwn(committedRaw, change.field) ? committedRaw[change.field] : committedRaw;
                applySingleCloudField(change.field, unwrapped);
                metaUpdates['_fieldSync/' + change.field] = now;
            }

            const userRef = cloudDb.ref('users/' + user.uid);
            if (typeof userRef.update === 'function') {
                await withCloudTimeout(userRef.update(metaUpdates), 'guardado_metadata');
            }

            if (cloudAuth.currentUser?.uid !== user.uid) return false;

            const clientNow = Date.now();
            const localVersions = getLocalFieldVersions(user.uid);
            for (const change of changes) {
                const pending = pendingChanges.get(change.key);
                if (pending?.version === change.version) pendingChanges.delete(change.key);
                else if (pending) pending.base = change.local;
                localVersions[change.field] = clientNow;
            }
            localVersions.lastSync = clientNow;
            saveLocalFieldVersions(user.uid, localVersions);

            syncStatus('Guardado en la nube');
            console.log('☁️ CapaSuite: ' + changes.length + ' módulo(s) guardados correctamente.');
            return true;
        } catch (error) {
            const isQuotaOrTimeout = error?.code === 'FIREBASE_TIMEOUT' || /quota|limit|bandwidth|exceeded/i.test(String(error?.message || ''));
            syncStatus(isQuotaOrTimeout ? '⚠️ Cuota Firebase agotada. Guardado solo en esta sesión.' : 'Error al guardar en la nube. Cambios pendientes.', true);
            const denied = /permission/i.test(String(error?.code || '') + ' ' + String(error?.message || ''));
            if (denied && !extendedSyncDisabled && changes.some(change => EXTENDED_SYNC_KEYS.has(change.key))) {
                console.warn('CapaSuite: la nube rechazó los ajustes compartidos; se sincronizarán solo los datos principales.');
                extendedSyncDisabled = true;
                for (const key of EXTENDED_SYNC_KEYS) pendingChanges.delete(key);
            }
            scheduleSyncRetry();
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
    prepareCloudAccount(user.uid);
    syncStatus('Comprobando versión…');
    try {
        const localVersions = getLocalFieldVersions(user.uid);
        let metaSnap = null;
        try {
            metaSnap = await withCloudTimeout(cloudDb.ref('users/' + user.uid + '/_fieldSync').once('value'), 'comprobacion_metadata');
        } catch (metaErr) {
            console.warn('CapaSuite: no se pudo consultar _fieldSync, intentando acceso directo.', metaErr);
        }

        const remoteMeta = metaSnap && typeof metaSnap.val === 'function' ? metaSnap.val() : null;
        const hasValidMeta = remoteMeta && typeof remoteMeta === 'object' && (typeof remoteMeta.lastSync === 'number' || typeof remoteMeta.hotelData === 'number');

        if (!hasValidMeta) {
            console.log('☁️ CapaSuite: sincronización completa inicial / migración...');
            const snapshot = await withCloudTimeout(cloudDb.ref('users/' + user.uid).once('value'), 'descarga_completa');
            if (cloudAuth.currentUser?.uid !== user.uid) return false;
            const cloudData = snapshot.val() || {};
            applyCloudData(cloudData);
            seedMissingCloudSettings(cloudData);

            const now = Date.now();
            const initMeta = { lastSync: now };
            for (const field of Object.values(syncFields)) {
                if (Object.hasOwn(cloudData, field)) initMeta[field] = now;
            }
            saveLocalFieldVersions(user.uid, initMeta);
            const metaRef = cloudDb.ref('users/' + user.uid + '/_fieldSync');
            if (typeof metaRef.set === 'function') {
                metaRef.set(initMeta).catch(() => {});
            }

            window._initialDownloadDone = true;
            startCloudListener(user.uid);
            syncStatus('Datos descargados de la nube');
            scheduleCloudUpload();
            return true;
        }

        const fieldsToFetch = [];
        for (const [key, field] of Object.entries(syncFields)) {
            if (!isSyncedKey(key)) continue;
            const remoteTime = remoteMeta[field];
            const localTime = localVersions[field] || 0;
            const localExists = CapaStorage.getItem(key) != null;

            if (remoteTime && (!localExists || remoteTime > localTime)) {
                fieldsToFetch.push(field);
            }
        }

        if (fieldsToFetch.length > 0) {
            console.log('☁️ CapaSuite: descargando ' + fieldsToFetch.length + ' módulo(s) modificados: ' + fieldsToFetch.join(', '));
            syncStatus('Descargando ' + fieldsToFetch.length + ' módulo(s)…');

            const results = await Promise.all(fieldsToFetch.map(async field => {
                const snap = await withCloudTimeout(cloudDb.ref('users/' + user.uid + '/' + field).once('value'), 'descarga_' + field);
                return { field, val: snap.val() };
            }));

            if (cloudAuth.currentUser?.uid !== user.uid) return false;

            const changedKeys = [];
            for (const { field, val } of results) {
                const changed = applySingleCloudField(field, val);
                if (changed) changedKeys.push(changed);
                localVersions[field] = remoteMeta[field] || Date.now();
            }
            if (changedKeys.length) {
                window.dispatchEvent(new CustomEvent('capasuite-data-synced', { detail: { keys: changedKeys, source: 'cloud' } }));
            }
        } else {
            console.log('☁️ CapaSuite: Caché local sincronizada. 0 módulos descargados.');
        }

        localVersions.lastSync = remoteMeta.lastSync || Date.now();
        saveLocalFieldVersions(user.uid, localVersions);

        for (const key of EXTENDED_SYNC_KEYS) {
            if (!isSyncedKey(key) || pendingChanges.has(key)) continue;
            const field = syncFields[key];
            if (!remoteMeta[field] && CapaStorage.getItem(key) != null) {
                pendingChanges.set(key, { base: null, version: 1 });
            }
        }

        window._initialDownloadDone = true;
        startCloudListener(user.uid);
        syncStatus('Sincronizado con la nube');
        scheduleCloudUpload();
        return true;
    } catch (error) {
        const isQuotaOrTimeout = error?.code === 'FIREBASE_TIMEOUT' || /quota|limit|bandwidth|exceeded/i.test(String(error?.message || ''));
        syncStatus(isQuotaOrTimeout ? '⚠️ Cuota Firebase agotada. Usando copia local.' : 'No se pudo descargar la nube. Mostrando copia local.', true);
        console.error('Error recuperando datos de Firebase:', error);
        return false;
    }
}

function stopCloudListener() {
    if (cloudListener && cloudListenerUid) {
        try {
            cloudDb.ref('users/' + cloudListenerUid + '/_fieldSync').off('value', cloudListener);
        } catch {}
    }
    cloudListener = null;
    cloudListenerUid = null;
    listenerPausedByVisibility = false;
}

function prepareCloudAccount(uid) {
    const previous = CapaStorage.getItem('cloud_account_uid');
    if (previous && previous !== uid) {
        stopCloudListener();
        if (window._syncTimer) clearTimeout(window._syncTimer);
        window._syncTimer = null;
        window._initialDownloadDone = false;
        const backupKey = 'cloud_account_backup_' + previous;
        const backup = JSON.stringify({ ...Object.fromEntries(Object.keys(syncFields).map(key => [key, CapaStorage.getItem(key)])), _pendingChanges: [...pendingChanges] });
        originalSetItem(backupKey, backup);
        if (CapaStorage.getItem(backupKey) !== backup) throw new Error('No se pudo conservar la copia de la cuenta anterior.');
        const restored = JSON.parse(CapaStorage.getItem('cloud_account_backup_' + uid) || '{}');
        pendingChanges.clear();
        for (const [key, change] of restored._pendingChanges || []) {
            if (Object.hasOwn(syncFields, key)) pendingChanges.set(key, change);
        }
        for (const key of Object.keys(syncFields)) {
            if (restored[key] != null) originalSetItem(key, restored[key]);
            else originalRemoveItem(key);
        }
    }
    originalSetItem('cloud_account_uid', uid);
}

window.addEventListener('capasuite-storage-warning', () => {
    syncStatus('Sin espacio para guardar de forma permanente. Copia temporal en esta pestaña.', true);
});

function startCloudListener(uid) {
    if (cloudListenerUid === uid && cloudListener) return;
    stopCloudListener();
    cloudListenerUid = uid;

    cloudListener = async snapshot => {
        if (uploadInFlight || cloudAuth.currentUser?.uid !== uid) return;
        const remoteMeta = snapshot.val();
        if (!remoteMeta) return;

        // Si es un snapshot de compatibilidad o mock de pruebas que contiene cadenas directamente:
        if (typeof remoteMeta.hotelData === 'string') {
            applyCloudData(remoteMeta);
            syncStatus(pendingChanges.size ? 'Cambios pendientes de guardar' : 'Sincronizado con la nube');
            return;
        }

        // Si la escritura provino de esta misma pestaña, no descargar nada
        if (remoteMeta._writer === CLIENT_SESSION_ID) {
            const localVersions = getLocalFieldVersions(uid);
            for (const [key, field] of Object.entries(syncFields)) {
                if (remoteMeta[field]) localVersions[field] = remoteMeta[field];
            }
            localVersions.lastSync = remoteMeta.lastSync || Date.now();
            saveLocalFieldVersions(uid, localVersions);
            return;
        }

        try {
            const localVersions = getLocalFieldVersions(uid);
            const fieldsToUpdate = [];

            for (const [key, field] of Object.entries(syncFields)) {
                if (!isSyncedKey(key)) continue;
                const remoteTime = remoteMeta[field];
                const localTime = localVersions[field] || 0;
                if (remoteTime && remoteTime > localTime) {
                    fieldsToUpdate.push(field);
                }
            }

            if (fieldsToUpdate.length > 0) {
                console.log('☁️ CapaSuite (listener): actualizando ' + fieldsToUpdate.length + ' módulo(s) modificados: ' + fieldsToUpdate.join(', '));
                const results = await Promise.all(fieldsToUpdate.map(async field => {
                    const snap = await cloudDb.ref('users/' + uid + '/' + field).once('value');
                    return { field, val: snap.val() };
                }));

                const changedKeys = [];
                for (const { field, val } of results) {
                    const changed = applySingleCloudField(field, val);
                    if (changed) changedKeys.push(changed);
                    localVersions[field] = remoteMeta[field] || Date.now();
                }
                localVersions.lastSync = remoteMeta.lastSync || Date.now();
                saveLocalFieldVersions(uid, localVersions);

                if (changedKeys.length) {
                    window.dispatchEvent(new CustomEvent('capasuite-data-synced', { detail: { keys: changedKeys, source: 'cloud' } }));
                }
            }
            syncStatus(pendingChanges.size ? 'Cambios pendientes de guardar' : 'Sincronizado con la nube');
        } catch (error) {
            syncStatus('No se pudo actualizar desde la nube.', true);
            console.error('Error en cloudListener:', error);
        }
    };

    cloudDb.ref('users/' + uid + '/_fieldSync').on('value', cloudListener, error => {
        syncStatus('Sin conexión con la nube.', true);
        console.error(error);
    });
}

if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (cloudListener && cloudListenerUid) {
                try {
                    cloudDb.ref('users/' + cloudListenerUid + '/_fieldSync').off('value', cloudListener);
                } catch {}
                cloudListener = null;
                listenerPausedByVisibility = true;
                console.log('⏸️ CapaSuite: pestaña oculta. Listener Firebase pausado para ahorrar ancho de banda.');
            }
        } else {
            if (listenerPausedByVisibility && cloudAuth.currentUser) {
                listenerPausedByVisibility = false;
                console.log('▶️ CapaSuite: pestaña activa. Reanudando listener Firebase...');
                startCloudListener(cloudAuth.currentUser.uid);
                downloadFromCloud().catch(err => console.error('Error sincronizando al reactivar pestaña:', err));
            }
        }
    });
}

function recordSyncChange(key, before, after) {
    if (applyingCloud || !isSyncedKey(key) || before === after) return;
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
    if (applyingCloud) return originalSetItem(key, value);
    const before = isSyncedKey(key) ? readLocalWithoutEcho(key) : null;
    const result = originalSetItem(key, value);
    recordSyncChange(key, before, value);
    return result;
};
CapaStorage.removeItem = function (key) {
    if (applyingCloud) { originalRemoveItem(key); return; }
    const before = isSyncedKey(key) ? readLocalWithoutEcho(key) : null;
    originalRemoveItem(key);
    recordSyncChange(key, before, null);
};

window.forceCloudUpload = async function () {
    try {
        await uploadToCloud();
        // A fresh server read of just hotelData supplies confirmation without 7MB download
        const snapshot = await cloudDb.ref('users/' + cloudAuth.currentUser.uid + '/hotelData').once('value');
        const hotels = parseSyncValue(snapshot.val()) || {};
        const years = Object.keys(hotels.Guadiana || {}).filter(y => /^\d{4}$/.test(y)).sort();
        alert('Nube verificada. Años de Guadiana guardados: ' + (years.join(', ') || 'sin datos'));
    } catch (error) {
        syncStatus('No se pudo verificar el guardado.', true);
        alert('No se ha confirmado el guardado en la nube: ' + error.message);
    }
};

window.addEventListener('beforeunload', event => {
    if (cloudAuth.currentUser && (pendingChanges.size || uploadInFlight)) {
        // Do not initiate an unreliable full-database write while closing a tab.
        event.preventDefault();
        event.returnValue = '';
    }
});
window.auth = cloudAuth;
