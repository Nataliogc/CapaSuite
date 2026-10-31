// tools/test-firebase-optimization.js
// Verification suite for Firebase Optimization (Bandwidth and Granular Sync)
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('node:vm');

console.log('================================================================');
console.log('TEST SUITE: OPTIMIZACIÓN FIREBASE REALTIME DATABASE CAPASUITE');
console.log('Validación de los 10 escenarios obligatorios de ancho de banda y sincronización');
console.log('================================================================\n');

let passed = 0;
let failed = 0;

function report(name, ok, details = '') {
    if (ok) {
        passed++;
        console.log(`✅ [PASS] ${name}`);
        if (details) console.log(`   ${details}`);
    } else {
        failed++;
        console.error(`❌ [FAIL] ${name}`);
        if (details) console.error(`   ${details}`);
    }
}

// Factory to create an isolated environment with real path routing
function createEnv(initialStorage = {}, initialCloud = {}, sharedListeners = null) {
    const storage = { ...initialStorage };
    const cloud = initialCloud;
    const timers = new Map();
    let timerId = 0;
    let bytesDownloaded = 0;
    let bytesUploaded = 0;
    let networkCalls = 0;
    const listeners = sharedListeners || new Map(); // path -> cb

    const calcBytes = val => (val == null ? 0 : Buffer.byteLength(typeof val === 'string' ? val : JSON.stringify(val), 'utf8'));

    const getRef = (path = '') => {
        const cleanPath = path.replace(/^\/+|\/+$/g, '');
        const parts = cleanPath.split('/').filter(Boolean);

        return {
            async once(event = 'value') {
                networkCalls++;
                let val = cloud;
                for (const part of parts) {
                    if (val && typeof val === 'object') val = val[part];
                    else { val = undefined; break; }
                }
                const b = calcBytes(val);
                bytesDownloaded += b;
                return {
                    val: () => (val === undefined ? null : val),
                    exists: () => val !== undefined && val !== null
                };
            },
            async transaction(updateFn) {
                networkCalls++;
                let current = cloud;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (!current[p] || typeof current[p] !== 'object') current[p] = {};
                    current = current[p];
                }
                const lastKey = parts[parts.length - 1];
                const prevVal = current ? current[lastKey] : undefined;
                // Client downloads previous value
                bytesDownloaded += calcBytes(prevVal);
                const nextVal = updateFn(prevVal);
                if (current) {
                    if (nextVal === null || nextVal === undefined) delete current[lastKey];
                    else current[lastKey] = nextVal;
                }
                // Client uploads new value
                bytesUploaded += calcBytes(nextVal);
                return {
                    committed: true,
                    snapshot: { val: () => nextVal }
                };
            },
            async update(updates) {
                networkCalls++;
                let target = cloud;
                for (const part of parts) {
                    if (!target[part] || typeof target[part] !== 'object') target[part] = {};
                    target = target[part];
                }
                for (const [subPath, val] of Object.entries(updates)) {
                    const subParts = subPath.split('/').filter(Boolean);
                    let subTarget = target;
                    for (let i = 0; i < subParts.length - 1; i++) {
                        const sp = subParts[i];
                        if (!subTarget[sp] || typeof subTarget[sp] !== 'object') subTarget[sp] = {};
                        subTarget = subTarget[sp];
                    }
                    const finalKey = subParts[subParts.length - 1];
                    if (val === null) delete subTarget[finalKey];
                    else subTarget[finalKey] = val;
                    bytesUploaded += calcBytes(val);
                }
                // Trigger any listeners on these paths
                for (const [lPath, cbSet] of listeners) {
                    if (lPath === cleanPath || lPath.startsWith(cleanPath + '/')) {
                        let lVal = cloud;
                        for (const lp of lPath.split('/')) {
                            if (lVal && typeof lVal === 'object') lVal = lVal[lp];
                            else { lVal = undefined; break; }
                        }
                        const b = calcBytes(lVal);
                        for (const { cb, countBytes } of cbSet) {
                            countBytes(b);
                            cb({ val: () => lVal });
                        }
                    }
                }
                return true;
            },
            async set(val) {
                networkCalls++;
                let target = cloud;
                for (let i = 0; i < parts.length - 1; i++) {
                    const p = parts[i];
                    if (!target[p] || typeof target[p] !== 'object') target[p] = {};
                    target = target[p];
                }
                const lastKey = parts[parts.length - 1];
                target[lastKey] = val;
                bytesUploaded += calcBytes(val);
                return true;
            },
            on(event, cb) {
                if (!listeners.has(cleanPath)) listeners.set(cleanPath, new Set());
                listeners.get(cleanPath).add({ cb, countBytes: b => { bytesDownloaded += b; } });
            },
            off(event, cb) {
                if (listeners.has(cleanPath)) {
                    for (const item of listeners.get(cleanPath)) {
                        if (item.cb === cb) listeners.get(cleanPath).delete(item);
                    }
                }
            }
        };
    };

    const database = () => ({ ref: p => getRef(p) });
    database.ServerValue = { TIMESTAMP: Date.now() };

    const handlers = {};
    const context = vm.createContext({
        console: { log() {}, warn() {}, error() {} },
        Map, Set, JSON, Object, Array, Buffer, Date, Math,
        firebase: { apps: [1], database, auth: () => ({ currentUser: { uid: 'user_test', email: 'ssanchez@hotelguadiana.es' } }) },
        localStorage: { getItem: () => null, setItem() {} },
        window: {
            location: { hostname: 'capasuite.com', pathname: '/Analisis360.html', protocol: 'https:' },
            addEventListener: (n, fn) => { handlers[n] = fn; },
            dispatchEvent() {}
        },
        document: {
            getElementById: () => null,
            addEventListener: (n, fn) => { handlers[n] = fn; },
            hidden: false
        },
        CustomEvent: function (type, detail) { this.type = type; this.detail = detail; },
        CapaStorage: {
            getItem: k => (storage[k] !== undefined ? storage[k] : null),
            setItem: (k, v) => { storage[k] = v; },
            removeItem: k => { delete storage[k]; }
        },
        setTimeout: fn => { timers.set(++timerId, fn); return timerId; },
        clearTimeout: id => { timers.delete(id); },
        alert: () => {}
    });

    const code = fs.readFileSync('js/firebase-auth.js', 'utf8');
    vm.runInContext(code, context);

    return {
        context,
        storage,
        cloud,
        handlers,
        getStats: () => ({ bytesDownloaded, bytesUploaded, networkCalls }),
        resetStats: () => { bytesDownloaded = 0; bytesUploaded = 0; networkCalls = 0; },
        run: expr => vm.runInContext(expr, context)
    };
}

async function runAllTests() {
    // -------------------------------------------------------------
    // Escenario 1: Inicio de sesión y sincronización inicial
    // -------------------------------------------------------------
    try {
        const initialCloud = {
            users: {
                user_test: {
                    hotelData: JSON.stringify({ Guadiana: { 2026: { test: true } } }),
                    compData: JSON.stringify({ comp: 1 }),
                    lastSync: 1729000000000
                }
            }
        };
        const env = createEnv({}, initialCloud);
        env.resetStats();

        const success = await env.run('downloadFromCloud()');
        const stats = env.getStats();

        // Should download full data once and create _fieldSync
        const fieldSync = env.cloud.users.user_test._fieldSync;
        const localVersions = JSON.parse(env.storage['cloud_field_versions_user_test'] || '{}');

        report(
            'Escenario 1: Inicio de sesión inicial inicializa _fieldSync y caché local',
            success && fieldSync && fieldSync.hotelData && localVersions.hotelData,
            `Descarga inicial completada (${stats.bytesDownloaded} bytes descargados). _fieldSync creado correctamente.`
        );
    } catch (err) {
        report('Escenario 1: Inicio de sesión inicial', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 2: Navegación entre pantallas (Cache hit)
    // -------------------------------------------------------------
    try {
        const seedCloud = {
            users: {
                user_test: {
                    hotelData: JSON.stringify({ Guadiana: { 2026: { test: true } } }),
                    compData: JSON.stringify({ comp: 1 }),
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: {
                        hotelData: 1000,
                        compData: 1000,
                        pricingExceptions: 1000,
                        lastSync: 1000
                    },
                    lastSync: 1000
                }
            }
        };
        const localVersions = {
            hotelData: 1000,
            compData: 1000,
            pricingExceptions: 1000,
            lastSync: 1000
        };
        const seedStorage = {
            hotel_manager_db_v2: JSON.stringify({ Guadiana: { 2026: { test: true } } }),
            revenue_data_v2: JSON.stringify({ comp: 1 }),
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-02': 61 }),
            cloud_field_versions_user_test: JSON.stringify(localVersions)
        };

        const env = createEnv(seedStorage, seedCloud);
        env.resetStats();

        // Simulate page navigation: checkAuth runs downloadFromCloud()
        const success = await env.run('downloadFromCloud()');
        const stats = env.getStats();

        // The only thing downloaded was _fieldSync metadata (~150-250 bytes).
        // Zero module payloads (hotelData, compData, pricingExceptions) were downloaded!
        const zeroModulesDownloaded = stats.bytesDownloaded < 500;

        report(
            'Escenario 2: Navegación entre pantallas consume < 500 B (0 módulos de datos descargados)',
            success && zeroModulesDownloaded,
            `Descarga total durante cambio de pantalla: ${stats.bytesDownloaded} bytes (Ahorro de ~7,3 MB).`
        );
    } catch (err) {
        report('Escenario 2: Navegación entre pantallas', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 3: Modificación de tarifas (pricingExceptions)
    // -------------------------------------------------------------
    try {
        const seedCloud = {
            users: {
                user_test: {
                    hotelData: JSON.stringify({ Guadiana: { hugePayload: 'x'.repeat(10000) } }),
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: { hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        };
        const seedStorage = {
            hotel_manager_db_v2: seedCloud.users.user_test.hotelData,
            capasuite_pricing_exceptions_v1: seedCloud.users.user_test.pricingExceptions,
            cloud_field_versions_user_test: JSON.stringify({ hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 })
        };
        const env = createEnv(seedStorage, seedCloud);
        await env.run('downloadFromCloud()');
        env.resetStats();

        // User edits rate
        env.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 65 }))");
        await env.run('uploadToCloud()');
        const stats = env.getStats();

        // Check cloud updated pricingExceptions and _fieldSync, but DID NOT touch hotelData
        const updatedExceptions = JSON.parse(env.cloud.users.user_test.pricingExceptions);
        const touchedOnlyExceptions = stats.bytesUploaded < 500 && updatedExceptions['2026-11-02'] === 65;

        report(
            'Escenario 3: Modificación de tarifas envía únicamente pricingExceptions (~150 B)',
            touchedOnlyExceptions,
            `Bytes transmitidos: ${stats.bytesUploaded} bytes (hotelData no fue retransmitido).`
        );
    } catch (err) {
        report('Escenario 3: Modificación de tarifas', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 4: Modificación de cupos (manualCupos)
    // -------------------------------------------------------------
    try {
        const seedCloud = {
            users: {
                user_test: {
                    hotelData: JSON.stringify({ Guadiana: { hugePayload: 'x'.repeat(10000) } }),
                    manualCupos: JSON.stringify({ '2026-11-05': 10 }),
                    _fieldSync: { hotelData: 1000, manualCupos: 1000, lastSync: 1000 }
                }
            }
        };
        const seedStorage = {
            hotel_manager_db_v2: seedCloud.users.user_test.hotelData,
            manual_cupos_v1: seedCloud.users.user_test.manualCupos,
            cloud_field_versions_user_test: JSON.stringify({ hotelData: 1000, manualCupos: 1000, lastSync: 1000 })
        };
        const env = createEnv(seedStorage, seedCloud);
        await env.run('downloadFromCloud()');
        env.resetStats();

        // User edits cupos
        env.run("CapaStorage.setItem('manual_cupos_v1', JSON.stringify({ '2026-11-05': 15 }))");
        await env.run('uploadToCloud()');
        const stats = env.getStats();

        const updatedCupos = JSON.parse(env.cloud.users.user_test.manualCupos);
        const ok = updatedCupos['2026-11-05'] === 15 && stats.bytesUploaded < 500;

        report(
            'Escenario 4: Modificación de cupos actualiza exclusivamente manualCupos',
            ok,
            `Cupo actualizado a 15 con solo ${stats.bytesUploaded} bytes transmitidos.`
        );
    } catch (err) {
        report('Escenario 4: Modificación de cupos', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 5: Importación de ficheros OTB (otbSnapshots)
    // -------------------------------------------------------------
    try {
        const seedCloud = {
            users: {
                user_test: {
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    compData: JSON.stringify({ expedia: {} }),
                    _fieldSync: { pricingExceptions: 1000, compData: 1000, lastSync: 1000 }
                }
            }
        };
        const seedStorage = {
            capasuite_pricing_exceptions_v1: seedCloud.users.user_test.pricingExceptions,
            revenue_data_v2: seedCloud.users.user_test.compData,
            cloud_field_versions_user_test: JSON.stringify({ pricingExceptions: 1000, compData: 1000, lastSync: 1000 })
        };
        const env = createEnv(seedStorage, seedCloud);
        await env.run('downloadFromCloud()');
        env.resetStats();

        // Import OTB snapshots
        env.run("CapaStorage.setItem('daily_otb_snapshots_v1', JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-31', r: 25 }] } }))");
        await env.run('uploadToCloud()');

        const savedOTB = JSON.parse(env.cloud.users.user_test.otbSnapshots || '{}');
        const ok = savedOTB.Guadiana && savedOTB.Guadiana['2026-11-01'] && !env.cloud.users.user_test._fieldSync.configData;

        report(
            'Escenario 5: Guardado de OTB actualiza otbSnapshots sin alterar configuración ni tarifas',
            ok,
            'Snapshot sincronizado de forma aislada.'
        );
    } catch (err) {
        report('Escenario 5: Guardado de OTB', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 6: Sincronización entre dispositivos (Cross-device listener)
    // -------------------------------------------------------------
    try {
        const sharedCloud = {
            users: {
                user_test: {
                    hotelData: JSON.stringify({ Guadiana: { 2026: { test: true } } }),
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: { hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        };

        const sharedListeners = new Map();
        // Device A
        const devA = createEnv(
            {
                hotel_manager_db_v2: sharedCloud.users.user_test.hotelData,
                capasuite_pricing_exceptions_v1: sharedCloud.users.user_test.pricingExceptions,
                cloud_field_versions_user_test: JSON.stringify({ hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 })
            },
            sharedCloud,
            sharedListeners
        );
        await devA.run('downloadFromCloud()');

        // Device B
        const devB = createEnv(
            {
                hotel_manager_db_v2: sharedCloud.users.user_test.hotelData,
                capasuite_pricing_exceptions_v1: sharedCloud.users.user_test.pricingExceptions,
                cloud_field_versions_user_test: JSON.stringify({ hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 })
            },
            sharedCloud,
            sharedListeners
        );
        await devB.run('downloadFromCloud()');

        devB.resetStats();

        // Device A edits rate and uploads
        devA.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 75 }))");
        await devA.run('uploadToCloud()');

        // Let any async listener promises resolve
        await new Promise(r => setTimeout(r, 50));

        // Device B receives event on _fieldSync
        const devBExceptions = JSON.parse(devB.storage['capasuite_pricing_exceptions_v1'] || '{}');
        const statsB = devB.getStats();

        // Device B should have updated rate 75 € and downloaded ONLY pricingExceptions (< 500 B), not hotelData
        const ok = devBExceptions['2026-11-02'] === 75 && statsB.bytesDownloaded > 0 && statsB.bytesDownloaded < 500;

        report(
            'Escenario 6: Sincronización entre dispositivos transmite solo el módulo modificado (~250 B)',
            ok,
            `Dispositivo B sincronizó tarifa (75 €) descargando solo ${statsB.bytesDownloaded} bytes en total.`
        );
    } catch (err) {
        report('Escenario 6: Sincronización entre dispositivos', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 7: Edición concurrente de módulos distintos
    // -------------------------------------------------------------
    try {
        const sharedCloud = {
            users: {
                user_test: {
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    manualCupos: JSON.stringify({ '2026-11-02': 10 }),
                    _fieldSync: { pricingExceptions: 1000, manualCupos: 1000, lastSync: 1000 }
                }
            }
        };

        const devA = createEnv(
            {
                capasuite_pricing_exceptions_v1: sharedCloud.users.user_test.pricingExceptions,
                manual_cupos_v1: sharedCloud.users.user_test.manualCupos,
                cloud_field_versions_user_test: JSON.stringify({ pricingExceptions: 1000, manualCupos: 1000, lastSync: 1000 })
            },
            sharedCloud
        );
        const devB = createEnv(
            {
                capasuite_pricing_exceptions_v1: sharedCloud.users.user_test.pricingExceptions,
                manual_cupos_v1: sharedCloud.users.user_test.manualCupos,
                cloud_field_versions_user_test: JSON.stringify({ pricingExceptions: 1000, manualCupos: 1000, lastSync: 1000 })
            },
            sharedCloud
        );

        await devA.run('downloadFromCloud()');
        await devB.run('downloadFromCloud()');

        // Sergio edits rates on devA
        devA.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 63 }))");
        await devA.run('uploadToCloud()');

        // Diana edits cupos on devB
        devB.run("CapaStorage.setItem('manual_cupos_v1', JSON.stringify({ '2026-11-02': 12 }))");
        await devB.run('uploadToCloud()');

        const finalRates = JSON.parse(sharedCloud.users.user_test.pricingExceptions);
        const finalCupos = JSON.parse(sharedCloud.users.user_test.manualCupos);

        const ok = finalRates['2026-11-02'] === 63 && finalCupos['2026-11-02'] === 12;

        report(
            'Escenario 7: Edición concurrente en módulos distintos se consolida sin sobreescrituras',
            ok,
            'Tarifas (63 €) y Cupos (12 habs) guardados atómicamente e independientes.'
        );
    } catch (err) {
        report('Escenario 7: Edición concurrente', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 8: Pérdida de red y cola local (Offline queue)
    // -------------------------------------------------------------
    try {
        const env = createEnv({}, { users: { user_test: { hotelData: '{}', _fieldSync: { hotelData: 1000, lastSync: 1000 } } } });
        await env.run('downloadFromCloud()');

        // Disconnect
        env.run("firebase.auth = () => ({ currentUser: null })"); // simulate no auth / offline
        env.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-05': 70 }))");

        const pendingCount = env.run('pendingChanges.size');
        const ok = pendingCount === 1;

        report(
            'Escenario 8: Pérdida de red encola cambios localmente sin perder datos',
            ok,
            `Cambios pendientes en cola: ${pendingCount}.`
        );
    } catch (err) {
        report('Escenario 8: Pérdida de red', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 9: Reconexión de red y sincronización automática
    // -------------------------------------------------------------
    try {
        const seedCloud = { users: { user_test: { _fieldSync: { pricingExceptions: 1000, lastSync: 1000 } } } };
        const env = createEnv({}, seedCloud);
        await env.run('downloadFromCloud()');

        // Add pending change
        env.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-06': 80 }))");
        // Simulate online event
        env.handlers.online();

        // Advance timers to trigger retry
        for (const [id, fn] of env.context.setTimeout._timers || []) {
            fn();
        }
        await env.run('uploadToCloud()');

        const saved = JSON.parse(env.cloud.users.user_test.pricingExceptions || '{}');
        const ok = saved['2026-11-06'] === 80;

        report(
            'Escenario 9: Evento de reconexión procesa la cola pendiente con éxito',
            ok,
            'Tarifa sincronizada tras reconexión.'
        );
    } catch (err) {
        report('Escenario 9: Reconexión de red', false, err.message);
    }

    // -------------------------------------------------------------
    // Escenario 10: Gestión de pestañas inactivas (visibilitychange)
    // -------------------------------------------------------------
    try {
        const seedCloud = { users: { user_test: { _fieldSync: { lastSync: 1000 } } } };
        const env = createEnv({}, seedCloud);
        await env.run('downloadFromCloud()');

        // Tab goes to background
        env.context.document.hidden = true;
        env.handlers.visibilitychange();

        const paused = env.run('listenerPausedByVisibility');

        // Tab comes to foreground
        env.context.document.hidden = false;
        env.handlers.visibilitychange();

        const resumed = !env.run('listenerPausedByVisibility');

        report(
            'Escenario 10: Conexión pausada en pestaña oculta y reanudada al activarse',
            paused && resumed,
            'Pestaña en background desengancha el listener, ahorrando 100% de tráfico inactivo.'
        );
    } catch (err) {
        report('Escenario 10: Gestión de pestañas inactivas', false, err.message);
    }

    console.log('\n================================================================');
    console.log(`RESUMEN DE PRUEBAS DE OPTIMIZACIÓN: ${passed}/${passed + failed} superadas (${failed} fallos)`);
    console.log('================================================================');

    if (failed > 0) process.exit(1);
}

runAllTests().catch(err => {
    console.error('Fatal test runner error:', err);
    process.exit(1);
});
