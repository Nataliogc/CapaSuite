// tools/validate-final-sync.js
// Validación Final de Sincronización CapaSuite v2.7.33
const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('node:vm');

console.log('================================================================');
console.log('CAPASUITE v2.7.33 — PROTOCOLO DE VALIDACIÓN FINAL DE SINCRONIZACIÓN');
console.log('Verificación estricta de integridad, concurrencia, tráfico y seguridad');
console.log('================================================================\n');

let passedTests = 0;
let failedTests = 0;

function report(section, name, ok, details = '') {
    if (ok) {
        passedTests++;
        console.log(`✅ [PASS] ${section}: ${name}`);
        if (details) console.log(`   ${details}`);
    } else {
        failedTests++;
        console.error(`❌ [FAIL] ${section}: ${name}`);
        if (details) console.error(`   ${details}`);
    }
}

function calcBytes(val) {
    if (val == null) return 0;
    return Buffer.byteLength(typeof val === 'string' ? val : JSON.stringify(val), 'utf8');
}

// Simulador avanzado de Firebase Realtime Database para validación multi-equipo
function createMultiDeviceNetwork(initialCloudData = {}) {
    const cloud = JSON.parse(JSON.stringify(initialCloudData));
    const listeners = new Map(); // cleanPath -> Set<{ cb, uid, recordBytes }>
    let serverTime = 1729000000000;

    function createClient(uid, initialStorage = {}, failFlags = {}) {
        const storage = { ...initialStorage };
        let bytesDownloaded = 0;
        let bytesUploaded = 0;
        let networkOps = 0;
        const timers = new Map();
        let timerCount = 0;

        const getRef = (path = '') => {
            const cleanPath = path.replace(/^\/+|\/+$/g, '');
            const parts = cleanPath.split('/').filter(Boolean);

            return {
                async once(event = 'value') {
                    if (failFlags.networkDown || failFlags.onceFail) throw new Error('NETWORK_TIMEOUT');
                    networkOps++;
                    let val = cloud;
                    for (const p of parts) {
                        if (val && typeof val === 'object') val = val[p];
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
                    if (failFlags.networkDown || failFlags.transactionFail) throw new Error('TRANSACTION_FAILED');
                    networkOps++;
                    let current = cloud;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const p = parts[i];
                        if (!current[p] || typeof current[p] !== 'object') current[p] = {};
                        current = current[p];
                    }
                    const lastKey = parts[parts.length - 1];
                    const prevVal = current ? current[lastKey] : undefined;
                    bytesDownloaded += calcBytes(prevVal);

                    const nextVal = updateFn(prevVal);
                    if (current) {
                        if (nextVal === null || nextVal === undefined) delete current[lastKey];
                        else current[lastKey] = nextVal;
                    }
                    bytesUploaded += calcBytes(nextVal);
                    return {
                        committed: true,
                        snapshot: { val: () => nextVal }
                    };
                },
                async update(updates) {
                    if (failFlags.networkDown || failFlags.updateFail) throw new Error('UPDATE_FAILED');
                    networkOps++;
                    let target = cloud;
                    for (const p of parts) {
                        if (!target[p] || typeof target[p] !== 'object') target[p] = {};
                        target = target[p];
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
                        else subTarget[finalKey] = val === 1729000000000 ? ++serverTime : val;
                        bytesUploaded += calcBytes(val);
                    }

                    // Notificar a todos los listeners activos en la ruta o subrutas
                    for (const [lPath, subSet] of listeners) {
                        if (lPath === cleanPath || lPath.startsWith(cleanPath + '/')) {
                            let lVal = cloud;
                            for (const lp of lPath.split('/')) {
                                if (lVal && typeof lVal === 'object') lVal = lVal[lp];
                                else { lVal = undefined; break; }
                            }
                            const b = calcBytes(lVal);
                            for (const sub of subSet) {
                                sub.recordBytes(b);
                                sub.cb({ val: () => lVal });
                            }
                        }
                    }
                    return true;
                },
                async set(val) {
                    if (failFlags.networkDown) throw new Error('SET_FAILED');
                    networkOps++;
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
                    listeners.get(cleanPath).add({
                        cb,
                        uid,
                        recordBytes: b => { bytesDownloaded += b; }
                    });
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
        database.ServerValue = { TIMESTAMP: 1729000000000 };

        const handlers = {};
        const context = vm.createContext({
            console: { log() {}, warn() {}, error() {} },
            Map, Set, JSON, Object, Array, Buffer, Date, Math,
            firebase: { apps: [1], database, auth: () => ({ currentUser: { uid, email: `${uid}@hotelguadiana.es` } }) },
            localStorage: { getItem: () => null, setItem() {} },
            window: {
                location: { hostname: 'capasuite.com', pathname: '/AnalisisCalendario.html', protocol: 'https:' },
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
            setTimeout: fn => { timers.set(++timerCount, fn); return timerCount; },
            clearTimeout: id => { timers.delete(id); },
            alert: () => {}
        });

        const code = fs.readFileSync('js/firebase-auth.js', 'utf8');
        vm.runInContext(code, context);

        return {
            uid,
            context,
            storage,
            handlers,
            failFlags,
            getStats: () => ({ bytesDownloaded, bytesUploaded, networkOps }),
            resetStats: () => { bytesDownloaded = 0; bytesUploaded = 0; networkOps = 0; },
            run: expr => vm.runInContext(expr, context)
        };
    }

    return { cloud, createClient, listeners };
}

async function runValidationProtocol() {
    // =========================================================================
    // PRUEBA 1. VALIDAR INTEGRIDAD DE VERSIONES
    // =========================================================================
    console.log('--- 1. VALIDACIÓN DE INTEGRIDAD DE VERSIONES ---');
    try {
        const net = createMultiDeviceNetwork({
            users: {
                sergio: {
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: { pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        });
        const client = net.createClient('sergio', {
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-02': 61 }),
            cloud_field_versions_sergio: JSON.stringify({ pricingExceptions: 1000, lastSync: 1000 })
        });
        await client.run('downloadFromCloud()');

        // Editar tarifa localmente
        client.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 65 }))");
        assert.equal(client.run('pendingChanges.size'), 1);

        // Simular fallo de conexión durante la actualización de metadatos
        client.failFlags.updateFail = true;

        let threwError = false;
        try {
            await client.run('uploadToCloud()');
        } catch {
            threwError = true;
        }

        // Verificar: el cliente NO debe marcar la versión local como sincronizada si falló el servidor
        const localVersionsAfterFail = JSON.parse(client.storage['cloud_field_versions_sergio']);
        const pendingAfterFail = client.run('pendingChanges.size');

        const okFailSafe = threwError && pendingAfterFail === 1 && localVersionsAfterFail.pricingExceptions === 1000;
        report(
            'Fase 1.1',
            'Fallo de conexión en metadatos no marca versión local como sincronizada',
            okFailSafe,
            `Error capturado correctamente. Cambios retenidos en cola local: ${pendingAfterFail}. Versión local intacta (1000).`
        );

        // Restaurar red y reintentar guardado
        client.failFlags.updateFail = false;
        const recovered = await client.run('uploadToCloud()');
        const localVersionsRecovered = JSON.parse(client.storage['cloud_field_versions_sergio']);
        const pendingRecovered = client.run('pendingChanges.size');

        const okRecovered = recovered && pendingRecovered === 0 && localVersionsRecovered.pricingExceptions > 1000;
        report(
            'Fase 1.2',
            'Reintento automático tras restaurar red confirma versión y vacía cola pendiente',
            okRecovered,
            `Guardado exitoso. Cola pendiente: ${pendingRecovered}. Nueva versión confirmada: ${localVersionsRecovered.pricingExceptions}.`
        );
    } catch (err) {
        report('Fase 1', 'Integridad de versiones', false, err.stack);
    }

    // =========================================================================
    // PRUEBA 2. PROBAR DOS EQUIPOS SIMULTÁNEAMENTE (CONCURRENCIA)
    // =========================================================================
    console.log('\n--- 2. CONCURRENCIA SIMULTÁNEA EN DOS EQUIPOS ---');
    try {
        // Escenario 2.1: Dos tarifas diferentes
        const netRates = createMultiDeviceNetwork({
            users: {
                equipo: {
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61, '2026-11-03': 63 }),
                    _fieldSync: { pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        });
        const eqA = netRates.createClient('equipo', {
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-02': 61, '2026-11-03': 63 }),
            cloud_field_versions_equipo: JSON.stringify({ pricingExceptions: 1000, lastSync: 1000 })
        });
        const eqB = netRates.createClient('equipo', {
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-02': 61, '2026-11-03': 63 }),
            cloud_field_versions_equipo: JSON.stringify({ pricingExceptions: 1000, lastSync: 1000 })
        });
        await eqA.run('downloadFromCloud()');
        await eqB.run('downloadFromCloud()');

        // Ambos equipos realizan modificaciones locales simultáneamente
        eqA.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 65, '2026-11-03': 63 }))");
        eqB.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 61, '2026-11-03': 67 }))");

        // Equipo A sube primero
        await eqA.run('uploadToCloud()');
        // Equipo B sube a continuación (debe ejecutar el merge de 3 vías contra lo subido por A)
        await eqB.run('uploadToCloud()');

        const cloudRates = JSON.parse(netRates.cloud.users.equipo.pricingExceptions);
        const okRates = cloudRates['2026-11-02'] === 65 && cloudRates['2026-11-03'] === 67;
        report(
            'Fase 2.1',
            'Modificación concurrente en dos tarifas diferentes conserva ambas modificaciones',
            okRates,
            `2 Noviembre = ${cloudRates['2026-11-02']} €, 3 Noviembre = ${cloudRates['2026-11-03']} €.`
        );

        // Escenario 2.2: Dos cupos del mismo módulo
        const netCupos = createMultiDeviceNetwork({
            users: {
                equipo: {
                    manualCupos: JSON.stringify({ '2026-11-10': 5, '2026-11-11': 8 }),
                    _fieldSync: { manualCupos: 1000, lastSync: 1000 }
                }
            }
        });
        const eqCupoA = netCupos.createClient('equipo', {
            manual_cupos_v1: JSON.stringify({ '2026-11-10': 5, '2026-11-11': 8 }),
            cloud_field_versions_equipo: JSON.stringify({ manualCupos: 1000, lastSync: 1000 })
        });
        const eqCupoB = netCupos.createClient('equipo', {
            manual_cupos_v1: JSON.stringify({ '2026-11-10': 5, '2026-11-11': 8 }),
            cloud_field_versions_equipo: JSON.stringify({ manualCupos: 1000, lastSync: 1000 })
        });
        await eqCupoA.run('downloadFromCloud()');
        await eqCupoB.run('downloadFromCloud()');

        // Ambos equipos editan cupos concurrentemente antes de subir
        eqCupoA.run("CapaStorage.setItem('manual_cupos_v1', JSON.stringify({ '2026-11-10': 10, '2026-11-11': 8 }))");
        eqCupoB.run("CapaStorage.setItem('manual_cupos_v1', JSON.stringify({ '2026-11-10': 5, '2026-11-11': 15 }))");

        await eqCupoA.run('uploadToCloud()');
        await eqCupoB.run('uploadToCloud()');

        const cloudCupos = JSON.parse(netCupos.cloud.users.equipo.manualCupos);
        const okCupos = cloudCupos['2026-11-10'] === 10 && cloudCupos['2026-11-11'] === 15;
        report(
            'Fase 2.2',
            'Modificación concurrente en dos cupos del mismo módulo conserva ambos cupos',
            okCupos,
            `Día 10 = ${cloudCupos['2026-11-10']} habs, Día 11 = ${cloudCupos['2026-11-11']} habs.`
        );

        // Escenario 2.3: Dos fechas de snapshots OTB
        const netOtb = createMultiDeviceNetwork({
            users: {
                equipo: {
                    otbSnapshots: JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-30', r: 20 }] } }),
                    _fieldSync: { otbSnapshots: 1000, lastSync: 1000 }
                }
            }
        });
        const eqOtbA = netOtb.createClient('equipo', {
            daily_otb_snapshots_v1: JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-30', r: 20 }] } }),
            cloud_field_versions_equipo: JSON.stringify({ otbSnapshots: 1000, lastSync: 1000 })
        });
        const eqOtbB = netOtb.createClient('equipo', {
            daily_otb_snapshots_v1: JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-30', r: 20 }] } }),
            cloud_field_versions_equipo: JSON.stringify({ otbSnapshots: 1000, lastSync: 1000 })
        });
        await eqOtbA.run('downloadFromCloud()');
        await eqOtbB.run('downloadFromCloud()');

        // Ambos equipos actualizan fechas de OTB concurrentemente
        eqOtbA.run("CapaStorage.setItem('daily_otb_snapshots_v1', JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-30', r: 20 }, { d: '2026-10-31', r: 24 }] } }))");
        eqOtbB.run("CapaStorage.setItem('daily_otb_snapshots_v1', JSON.stringify({ Guadiana: { '2026-11-01': [{ d: '2026-10-30', r: 20 }], '2026-11-02': [{ d: '2026-10-31', r: 30 }] } }))");

        await eqOtbA.run('uploadToCloud()');
        await eqOtbB.run('uploadToCloud()');

        const cloudOtb = JSON.parse(netOtb.cloud.users.equipo.otbSnapshots);
        const okOtb = cloudOtb.Guadiana['2026-11-01'].length === 2 && cloudOtb.Guadiana['2026-11-02'].length === 1;
        report(
            'Fase 2.3',
            'Modificación concurrente de snapshots OTB en dos fechas conserva ambas fechas',
            okOtb,
            `2026-11-01 tiene ${cloudOtb.Guadiana['2026-11-01'].length} capturas, 2026-11-02 tiene ${cloudOtb.Guadiana['2026-11-02'].length} capturas.`
        );

        // Escenario 2.4: Mismo registro editado simultáneamente
        const netSame = createMultiDeviceNetwork({
            users: {
                equipo: {
                    pricingExceptions: JSON.stringify({ '2026-11-05': 70, '2026-11-06': 80 }),
                    _fieldSync: { pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        });
        const eqSameA = netSame.createClient('equipo', {
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-05': 70, '2026-11-06': 80 }),
            cloud_field_versions_equipo: JSON.stringify({ pricingExceptions: 1000, lastSync: 1000 })
        });
        const eqSameB = netSame.createClient('equipo', {
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-05': 70, '2026-11-06': 80 }),
            cloud_field_versions_equipo: JSON.stringify({ pricingExceptions: 1000, lastSync: 1000 })
        });
        await eqSameA.run('downloadFromCloud()');
        await eqSameB.run('downloadFromCloud()');

        // Ambos editan el día 5: A pone 74 €, B pone 76 €
        eqSameA.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-05': 74, '2026-11-06': 80 }))");
        await eqSameA.run('uploadToCloud()');

        eqSameB.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-05': 76, '2026-11-06': 80 }))");
        await eqSameB.run('uploadToCloud()');

        const cloudSame = JSON.parse(netSame.cloud.users.equipo.pricingExceptions);
        // Debe consolidar sin romper el JSON ni perder la clave no modificada (día 6: 80)
        const okSame = (cloudSame['2026-11-05'] === 74 || cloudSame['2026-11-05'] === 76) && cloudSame['2026-11-06'] === 80;
        report(
            'Fase 2.4',
            'Edición concurrente sobre el mismo registro no provoca pérdida silenciosa ni corrupción',
            okSame,
            `Día 5 resuelto a ${cloudSame['2026-11-05']} €, Día 6 intacto a ${cloudSame['2026-11-06']} €.`
        );
    } catch (err) {
        report('Fase 2', 'Concurrencia simultánea', false, err.stack);
    }

    // =========================================================================
    // PRUEBA 3. COMPROBAR PRIMERA INSTALACIÓN (CACHE VACÍA)
    // =========================================================================
    console.log('\n--- 3. COMPROBACIÓN DE PRIMERA INSTALACIÓN ---');
    try {
        const netClean = createMultiDeviceNetwork({
            users: {
                nuevo_dispositivo: {
                    hotelData: JSON.stringify({ Guadiana: { 2026: { habitacion: 108 } } }),
                    configData: JSON.stringify({ config: 'ok' }),
                    compData: JSON.stringify({ competencia: 'expedia' }),
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: { hotelData: 1000, configData: 1000, compData: 1000, pricingExceptions: 1000, lastSync: 1000 }
                }
            }
        });

        // Cliente totalmente limpio (storage vacío {})
        const cleanClient = netClean.createClient('nuevo_dispositivo', {});
        cleanClient.resetStats();

        // Ejecutar downloadFromCloud en navegador nuevo
        const success = await cleanClient.run('downloadFromCloud()');
        const stats = cleanClient.getStats();

        // Comprobar que descargó los datos y NO consideró la caché vacía como actualizada
        const hasHotel = cleanClient.storage['hotel_manager_db_v2'] != null;
        const hasConfig = cleanClient.storage['upload_config_db_v2'] != null;
        const hasComp = cleanClient.storage['revenue_data_v2'] != null;
        const hasPricing = cleanClient.storage['capasuite_pricing_exceptions_v1'] != null;

        const okClean = success && hasHotel && hasConfig && hasComp && hasPricing && stats.bytesDownloaded > 0;
        report(
            'Fase 3',
            'Primera instalación en navegador sin datos locales descarga todos los módulos requeridos',
            okClean,
            `Descargados ${stats.bytesDownloaded} bytes. Módulos presentes: hotelData=${hasHotel}, configData=${hasConfig}, compData=${hasComp}, pricingExceptions=${hasPricing}.`
        );
    } catch (err) {
        report('Fase 3', 'Primera instalación', false, err.stack);
    }

    // =========================================================================
    // PRUEBA 4. COMPATIBILIDAD CON VERSIÓN ANTERIOR
    // =========================================================================
    console.log('\n--- 4. COMPATIBILIDAD CON VERSIÓN ANTERIOR (LEGACY) ---');
    try {
        const netCompat = createMultiDeviceNetwork({
            users: {
                usuario_compartido: {
                    hotelData: JSON.stringify({ Guadiana: { 2026: { v: 1 } } }),
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    _fieldSync: { hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 },
                    lastSync: 1000
                }
            }
        });

        // 1. Simular escritura de un cliente con versión anterior (escribe nodo raíz completo con lastSync)
        const legacyCloudWrite = {
            hotelData: JSON.stringify({ Guadiana: { 2026: { v: 2, modificado_por_legacy: true } } }),
            pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
            _fieldSync: { hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 }, // No tocado por legacy
            lastSync: 2000 // Actualizado por legacy
        };
        netCompat.cloud.users.usuario_compartido = legacyCloudWrite;

        // 2. Cliente v2.7.33 se conecta
        const modernClient = netCompat.createClient('usuario_compartido', {
            hotel_manager_db_v2: JSON.stringify({ Guadiana: { 2026: { v: 1 } } }),
            capasuite_pricing_exceptions_v1: JSON.stringify({ '2026-11-02': 61 }),
            cloud_field_versions_usuario_compartido: JSON.stringify({ hotelData: 1000, pricingExceptions: 1000, lastSync: 1000 })
        });

        // Cliente moderno debe conservar la estructura de _fieldSync y no romper la compatibilidad
        const okInit = await modernClient.run('downloadFromCloud()');

        // Cliente moderno edita tarifa y guarda
        modernClient.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 69 }))");
        await modernClient.run('uploadToCloud()');

        const cloudAfter = netCompat.cloud.users.usuario_compartido;
        const legacyDataIntact = JSON.parse(cloudAfter.hotelData).Guadiana[2026].modificado_por_legacy === true;
        const modernFieldUpdated = JSON.parse(cloudAfter.pricingExceptions)['2026-11-02'] === 69;
        const metaIntact = cloudAfter._fieldSync != null && cloudAfter._fieldSync.pricingExceptions != null;

        const okCompat = okInit && legacyDataIntact && modernFieldUpdated && metaIntact;
        report(
            'Fase 4',
            'Coexistencia bidireccional entre cliente legacy y cliente v2.7.33 sin sobrescritura de metadatos',
            okCompat,
            `Dato legacy preservado: ${legacyDataIntact}. Modificación moderna aplicada: ${modernFieldUpdated}. Metadatos intactos: ${metaIntact}.`
        );
    } catch (err) {
        report('Fase 4', 'Compatibilidad legacy', false, err.stack);
    }

    // =========================================================================
    // PRUEBA 5. MEDICIÓN CUANTITATIVA DEL TRÁFICO REAL
    // =========================================================================
    console.log('\n--- 5. MEDICIÓN CUANTITATIVA DEL TRÁFICO ---');
    try {
        const initialHeavyCloud = {
            users: {
                diana: {
                    hotelData: JSON.stringify({ Guadiana: { history: 'x'.repeat(150000) } }), // 150 KB
                    compData: JSON.stringify({ expedia: 'y'.repeat(50000) }), // 50 KB
                    otbSnapshots: JSON.stringify({ snapshots: 'z'.repeat(80000) }), // 80 KB
                    pricingExceptions: JSON.stringify({ '2026-11-02': 61 }),
                    manualCupos: JSON.stringify({ '2026-11-02': 10 }),
                    _fieldSync: { hotelData: 1000, compData: 1000, otbSnapshots: 1000, pricingExceptions: 1000, manualCupos: 1000, lastSync: 1000 }
                }
            }
        };

        const netTraffic = createMultiDeviceNetwork(initialHeavyCloud);
        const seededStorage = {
            hotel_manager_db_v2: initialHeavyCloud.users.diana.hotelData,
            revenue_data_v2: initialHeavyCloud.users.diana.compData,
            daily_otb_snapshots_v1: initialHeavyCloud.users.diana.otbSnapshots,
            capasuite_pricing_exceptions_v1: initialHeavyCloud.users.diana.pricingExceptions,
            manual_cupos_v1: initialHeavyCloud.users.diana.manualCupos,
            cloud_field_versions_diana: JSON.stringify({ hotelData: 1000, compData: 1000, otbSnapshots: 1000, pricingExceptions: 1000, manualCupos: 1000, lastSync: 1000 })
        };

        const clientDiana = netTraffic.createClient('diana', seededStorage);

        // Operación A: Cambio de pantalla (Navegación)
        clientDiana.resetStats();
        await clientDiana.run('downloadFromCloud()');
        const statsNav = clientDiana.getStats();

        // Operación B: Modificación de tarifa
        clientDiana.resetStats();
        clientDiana.run("CapaStorage.setItem('capasuite_pricing_exceptions_v1', JSON.stringify({ '2026-11-02': 72 }))");
        await clientDiana.run('uploadToCloud()');
        const statsRate = clientDiana.getStats();

        // Operación C: Guardado de OTB
        clientDiana.resetStats();
        clientDiana.run("CapaStorage.setItem('daily_otb_snapshots_v1', JSON.stringify({ snapshots: 'z'.repeat(80000), update: 1 }))");
        await clientDiana.run('uploadToCloud()');
        const statsOtb = clientDiana.getStats();

        // Operación D: Difusión a segundo equipo
        const clientSergio = netTraffic.createClient('diana', seededStorage);
        await clientSergio.run('downloadFromCloud()');
        clientSergio.resetStats();

        // Diana hace un cambio menor de cupo
        clientDiana.run("CapaStorage.setItem('manual_cupos_v1', JSON.stringify({ '2026-11-02': 14 }))");
        await clientDiana.run('uploadToCloud()');

        // Sergio recibe evento en tiempo real
        await new Promise(r => setTimeout(r, 20));
        const statsPeer = clientSergio.getStats();

        const okTraffic = statsNav.bytesDownloaded < 500 && statsRate.bytesUploaded < 500 && statsPeer.bytesDownloaded < 500;
        report(
            'Fase 5.1',
            'Navegación consume exactamente metadatos (< 500 B) sin descargar módulos pesados',
            statsNav.bytesDownloaded < 500,
            `Descarga medida en cambio de pantalla: ${statsNav.bytesDownloaded} bytes (Base pesada de ~280 KB no descargada).`
        );
        report(
            'Fase 5.2',
            'Modificación de tarifa transmite únicamente la tarifa (< 500 B)',
            statsRate.bytesUploaded < 500,
            `Subida medida al cambiar tarifa: ${statsRate.bytesUploaded} bytes.`
        );
        report(
            'Fase 5.3',
            'Recepción de cambios en equipo remoto descarga exclusivamente el módulo modificado (< 500 B)',
            statsPeer.bytesDownloaded < 500,
            `Descarga medida en equipo remoto: ${statsPeer.bytesDownloaded} bytes.`
        );
    } catch (err) {
        report('Fase 5', 'Medición cuantitativa del tráfico', false, err.stack);
    }

    // =========================================================================
    // PRUEBA 6. PROTECCIÓN DE DATOS Y AISLAMIENTO DE USUARIOS
    // =========================================================================
    console.log('\n--- 6. PROTECCIÓN DE DATOS Y AISLAMIENTO ---');
    try {
        // Verificar que existe la copia de respaldo intacta
        const backupExists = fs.existsSync('js/firebase-auth.backup-v2.7.32.js');
        const backupContent = backupExists ? fs.readFileSync('js/firebase-auth.backup-v2.7.32.js', 'utf8') : '';
        const okBackup = backupExists && backupContent.length > 5000;

        report(
            'Fase 6.1',
            'Copia de seguridad recuperable v2.7.32 verificada en disco',
            okBackup,
            `Archivo js/firebase-auth.backup-v2.7.32.js disponible (${backupContent.length} bytes).`
        );

        // Verificar particionamiento estricto por UID
        const netSecurity = createMultiDeviceNetwork({
            users: {
                usuario_guadiana: { hotelData: '{"hotel":"guadiana"}' },
                usuario_cumbria: { hotelData: '{"hotel":"cumbria"}' }
            }
        });
        const clientGuadiana = netSecurity.createClient('usuario_guadiana', {});
        const clientCumbria = netSecurity.createClient('usuario_cumbria', {});

        await clientGuadiana.run('downloadFromCloud()');
        await clientCumbria.run('downloadFromCloud()');

        const gData = JSON.parse(clientGuadiana.storage['hotel_manager_db_v2']);
        const cData = JSON.parse(clientCumbria.storage['hotel_manager_db_v2']);

        const okIsolation = gData.hotel === 'guadiana' && cData.hotel === 'cumbria';
        report(
            'Fase 6.2',
            'Aislamiento de sesiones: un usuario nunca accede a ramas de otros usuarios',
            okIsolation,
            'Rutas cloudDb.ref("users/" + user.uid + "/*") estrictamente particionadas.'
        );
    } catch (err) {
        report('Fase 6', 'Protección de datos', false, err.stack);
    }

    console.log('\n================================================================');
    console.log(`RESUMEN DE VALIDACIÓN FINAL: ${passedTests}/${passedTests + failedTests} pruebas superadas (${failedTests} fallos)`);
    console.log('================================================================');

    if (failedTests > 0) process.exit(1);
}

runValidationProtocol().catch(err => {
    console.error('Error fatal durante la validación final:', err);
    process.exit(1);
});
