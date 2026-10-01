/* Import provenance, immutable observations and recoverable local checkpoints. */
(function (root) {
    'use strict';
    const KEYS = ['hotel_manager_db_v2', 'upload_config_db_v2', 'segment_forecast_v2', 'revenue_data_v2', 'custom_events', 'manual_cupos_v1', 'segment_mappings_Guadiana', 'segment_mappings_Cumbria'];
    const finite = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
    const origin = row => JSON.stringify([row.originalOwner || row.owner, row.originalId || row.id]);
    function validDate(iso) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
        const date = new Date(iso + 'T00:00:00Z');
        return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso;
    }
    function parse(values, key) { return values[key] == null ? {} : JSON.parse(values[key]); }
    function observe(values, hotel, mode, preferSegments = true) {
        const days = {}, issues = [], invalidDays = new Set(), segmentData = parse(values, 'segment_forecast_v2')[hotel]?.segment;
        const add = (iso, row, fromSegments) => {
            if (!validDate(iso)) { issues.push('Fecha no válida: ' + iso); return; }
            const rooms = finite(typeof row === 'number' ? row : row?.rooms);
            const accommodation = finite(fromSegments
                ? row?.accommodationVerified === false ? null : row?.accommodation
                : row?.breakdown?.habitacion);
            if (rooms == null || rooms < 0) { issues.push('Habitaciones no verificables en ' + iso); invalidDays.add(iso); return; }
            if (!fromSegments) { days[iso] = { rooms, accommodation }; return; }
            const day = days[iso] ||= { rooms: 0, accommodation: 0 };
            day.rooms += rooms;
            day.accommodation = day.accommodation == null || accommodation == null ? null : day.accommodation + accommodation;
        };
        const engine = mode === 'forecast' && preferSegments && segmentData ? 'segment-forecast' : mode === 'forecast' ? 'daily-otb' : 'daily-production';
        if (engine === 'segment-forecast') {
            for (const segment of Object.values(segmentData)) {
                for (const [iso, row] of Object.entries(segment.days || {})) add(iso, row, true);
            }
        } else {
            for (const [year, data] of Object.entries(parse(values, 'hotel_manager_db_v2')[hotel] || {})) {
                if (!/^\d{4}$/.test(year)) continue;
                for (const [iso, row] of Object.entries(data[mode === 'forecast' ? 'daily_otb' : 'daily'] || {})) {
                    if (!iso.startsWith(year + '-')) { issues.push('Fecha fuera del ejercicio: ' + iso); continue; }
                    add(iso, row, false);
                }
            }
        }
        for (const iso of invalidDays) delete days[iso];
        return { days, engine, issues, coverage: Object.keys(days).sort() };
    }
    function compare(previous, current, month = '') {
        if (!previous || !current || previous.hotel !== current.hotel || previous.mode !== current.mode || previous.observation.engine !== current.observation.engine) {
            return { available: false, reason: 'Selecciona dos capturas del mismo hotel, tipo y origen de datos.' };
        }
        if (current.capturedAt < previous.capturedAt) return { available: false, reason: 'La captura actual debe ser posterior a la anterior.' };
        const before = previous.observation.days, after = current.observation.days;
        const selected = iso => !month || iso.startsWith(month + '-');
        const oldDates = Object.keys(before).filter(selected), newDates = Object.keys(after).filter(selected);
        const dates = newDates.filter(iso => Object.hasOwn(before, iso)).sort();
        const missing = [...new Set([...oldDates, ...newDates])].filter(iso => !Object.hasOwn(before, iso) || !Object.hasOwn(after, iso));
        const rows = dates.map(iso => ({ iso, previousRooms: before[iso].rooms, rooms: after[iso].rooms,
            roomsDelta: after[iso].rooms - before[iso].rooms,
            accommodationDelta: before[iso].accommodation == null || after[iso].accommodation == null ? null : after[iso].accommodation - before[iso].accommodation }));
        return { available: rows.length > 0, reason: rows.length ? '' : 'No hay fechas cubiertas por ambas capturas.',
            rows, missing, fullCoverage: missing.length === 0, matchedDays: dates.length,
            roomsDelta: rows.reduce((n, r) => n + r.roomsDelta, 0),
            accommodationDelta: rows.some(r => r.accommodationDelta == null) ? null : rows.reduce((n, r) => n + r.accommodationDelta, 0) };
    }
    function indexedRepository() {
        let opening;
        function open() {
            if (!root.indexedDB) return Promise.reject(new Error('Este navegador no permite guardar el histórico.'));
            if (!opening) opening = new Promise((resolve, reject) => {
                const request = root.indexedDB.open('capasuite_revenue_history', 1);
                request.onupgradeneeded = () => {
                    const store = request.result.createObjectStore('imports', { keyPath: 'id' });
                    store.createIndex('owner', 'owner');
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => { opening = null; reject(request.error); };
                request.onblocked = () => reject(new Error('Cierra las otras pestañas para preparar el histórico.'));
            });
            return opening;
        }
        async function run(mode, operation) {
            const db = await open();
            return new Promise((resolve, reject) => {
                const transaction = db.transaction('imports', mode);
                const request = operation(transaction.objectStore('imports'));
                transaction.oncomplete = () => resolve(request.result);
                transaction.onerror = transaction.onabort = () => reject(transaction.error || new Error('No se ha podido guardar el histórico.'));
            });
        }
        return { put: row => run('readwrite', store => store.put(row)), get: id => run('readonly', store => store.get(id)),
            list: owner => run('readonly', store => store.index('owner').getAll(owner)) };
    }
    function repairSheetCells(sheet) {
        if (!sheet) return;
        if (typeof sheet['!ref'] === 'string') {
            sheet['!ref'] = sheet['!ref'].replace(/([A-Z]*)([B-Z])@(\d+)/g, (_, pre, ch, row) =>
                pre + String.fromCharCode(ch.charCodeAt(0) - 1) + 'Z' + row
            );
        }
        for (const key of Object.keys(sheet)) {
            if (key.startsWith('!')) continue;
            const match = key.match(/^([A-Z]*)([B-Z])@(\d+)$/);
            if (match) {
                const prefix = match[1];
                const prevChar = String.fromCharCode(match[2].charCodeAt(0) - 1);
                const row = match[3];
                const correctedKey = prefix + prevChar + 'Z' + row;
                sheet[correctedKey] = sheet[key];
                delete sheet[key];
            }
        }
    }
    function repairWorkbook(workbook) {
        if (!workbook?.SheetNames || !workbook.Sheets) return workbook;
        for (const name of workbook.SheetNames) {
            repairSheetCells(workbook.Sheets[name]);
        }
        return workbook;
    }
    function ensureXLSXRepairs(XLSX) {
        if (!XLSX || XLSX.__repaired_read) return;
        const origRead = XLSX.read;
        if (typeof origRead === 'function') {
            XLSX.read = function (data, opts) {
                if (data instanceof ArrayBuffer) data = new Uint8Array(data);
                const wb = origRead.call(this, data, opts);
                return repairWorkbook(wb);
            };
            XLSX.__repaired_read = true;
        }
    }
    if (root.XLSX) ensureXLSXRepairs(root.XLSX);
    async function fingerprint(file) {
        if (!file?.arrayBuffer || !root.crypto?.subtle) return null;
        const bytes = await root.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
        return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
    }
    async function contentFingerprint(file) {
        if (!file?.arrayBuffer || !root.XLSX || !root.crypto?.subtle) return null;
        ensureXLSXRepairs(root.XLSX);
        const buffer = await file.arrayBuffer();
        const data = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer;
        const workbook = repairWorkbook(root.XLSX.read(data, { type: 'array' }));
        for (const name of workbook.SheetNames) {
            if (Object.keys(workbook.Sheets[name]).some(key => !key.startsWith('!') && !/^[A-Z]+\d+$/.test(key))) {
                throw new Error('El Excel contiene referencias de celda no válidas. Vuelve a exportarlo desde el PMS antes de importar; no se han modificado los datos.');
            }
        }
        const content = workbook.SheetNames.map(name => root.XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: null, blankrows: false }));
        const bytes = await root.crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(content)));
        return Array.from(new Uint8Array(bytes), n => n.toString(16).padStart(2, '0')).join('');
    }
    function createService({ storage, repository, owner, now = () => new Date().toISOString(), hash = fingerprint, contentHash = contentFingerprint, id = () => root.crypto?.randomUUID?.() || Date.now() + '-' + Math.random().toString(36).slice(2) }) {
        const read = () => Object.fromEntries(KEYS.map(key => [key, storage.getItem(key) ?? null]));
        const owned = row => { if (!row || row.owner !== owner()) throw new Error('La captura no pertenece a la cuenta activa.'); return row; };
        async function inspectFile(file, metadata) {
            const sha256 = await hash(file), contentSha256 = await contentHash(file);
            if (!sha256) throw new Error('No se puede verificar el contenido del archivo. Abre CapaSuite en una conexión segura antes de importar.');
            const records = (await repository.list(owner())).filter(r => r.hotel === metadata.hotel && r.status === 'committed' && r.source?.sha256);
            const duplicate = records.find(r => r.source.sha256 === sha256 || contentSha256 && r.source.contentSha256 === contentSha256);
            if (duplicate) return { status: 'duplicate', sha256, contentSha256, capturedAt: duplicate.capturedAt,
                message: 'Estos mismos datos ya se cargaron el ' + new Date(duplicate.capturedAt).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) + '. No se volverán a importar.' };
            const prior = records.find(r => r.source.name === file.name && r.type === metadata.type && r.mode === metadata.mode);
            return { status: prior ? 'changed' : 'new', sha256, contentSha256,
                message: prior ? 'Versión distinta: el contenido ha cambiado respecto a la carga anterior. Revisa hotel y periodo antes de importar.' : 'Archivo sin una versión registrada comparable. Se comprobará de nuevo antes de importar.' };
        }
        async function begin(file, metadata) {
            if (!['Guadiana', 'Cumbria'].includes(metadata.hotel)) throw new Error('Hotel no válido.');
            const version = file ? await inspectFile(file, metadata) : null;
            if (version?.status === 'duplicate') throw new Error(version.message);
            const row = { id: id(), owner: owner(), hotel: metadata.hotel, mode: metadata.mode || 'actual',
                type: metadata.type || '', period: metadata.period || '', preferSegments: metadata.preferSegments !== false,
                capturedAt: now(), status: 'prepared', before: read(),
                source: { name: file?.name || (metadata.type === 'Restauración' ? 'Restauración de copia' : 'Captura manual'), size: file?.size ?? null, modifiedAt: file?.lastModified ? new Date(file.lastModified).toISOString() : null, sha256: version?.sha256 || null, contentSha256: version?.contentSha256 || null } };
            await repository.put(row); // A checkpoint must exist before modifying imported data.
            return row.id;
        }
        async function commit(identifier, metadata = {}) {
            const row = owned(await repository.get(identifier));
            if (row.status !== 'prepared') throw new Error('Esta carga ya está cerrada.');
            if (metadata.mode) row.mode = metadata.mode;
            if (metadata.period) row.period = metadata.period;
            if (metadata.preferSegments != null) row.preferSegments = metadata.preferSegments;
            const values = read();
            row.observation = observe(values, row.hotel, row.mode, row.preferSegments);
            row.status = 'committed'; row.completedAt = now();
            row.persistence = Object.keys(values).filter(key => values[key] !== row.before[key]).every(key => {
                try { return root.localStorage?.getItem('v3_' + key) === values[key]; } catch (e) { return false; }
            });
            await repository.put(row);
            return row;
        }
        async function fail(identifier, error) {
            const row = owned(await repository.get(identifier));
            if (row.status !== 'prepared') return;
            row.status = 'failed'; row.error = String(error?.message || error); await repository.put(row);
        }
        const list = async hotel => {
            const seen = new Set();
            return (await repository.list(owner())).filter(r => !hotel || r.hotel === hotel)
                .sort((a, b) => b.capturedAt.localeCompare(a.capturedAt) || b.id.localeCompare(a.id))
                .filter(row => { const key = origin(row); if (seen.has(key)) return false; seen.add(key); return true; });
        };
        function validateBackup(bundle) {
            if (bundle?.format !== 'capasuite-revenue-backup' || bundle.version !== 1 || !bundle.values || typeof bundle.values !== 'object') throw new Error('La copia no tiene un formato compatible.');
            for (const [key, value] of Object.entries(bundle.values)) {
                if (!KEYS.includes(key) || value != null && typeof value !== 'string') throw new Error('La copia contiene datos no admitidos.');
                if (value != null) {
                    const parsed = JSON.parse(value);
                    if (!parsed || typeof parsed !== 'object') throw new Error('Datos no válidos en la copia.');
                }
            }
            if (!KEYS.every(key => Object.hasOwn(bundle.values, key))) throw new Error('La copia está incompleta.');
            if (!Array.isArray(bundle.records || [])) throw new Error('El histórico de la copia no es válido.');
            for (const record of bundle.records || []) {
                if (!record || typeof record.id !== 'string' || !['Guadiana', 'Cumbria'].includes(record.hotel) || !['actual', 'forecast'].includes(record.mode)
                    || !['prepared', 'committed', 'failed'].includes(record.status) || typeof record.source?.name !== 'string'
                    || !Number.isFinite(Date.parse(record.capturedAt))) throw new Error('La copia contiene una captura no válida.');
                validateBackup({ format: bundle.format, version: 1, values: record.before });
                if (record.status === 'committed') {
                    if (!record.observation?.days || !Array.isArray(record.observation.coverage) || !Array.isArray(record.observation.issues)
                        || !['segment-forecast', 'daily-otb', 'daily-production'].includes(record.observation.engine)) throw new Error('La captura no contiene una observación válida.');
                    for (const [iso, day] of Object.entries(record.observation.days)) {
                        if (!validDate(iso) || finite(day?.rooms) == null || day.rooms < 0 || day.accommodation != null && finite(day.accommodation) == null) throw new Error('La captura contiene cifras o fechas no válidas.');
                    }
                    if (JSON.stringify(record.observation.coverage) !== JSON.stringify(Object.keys(record.observation.days).sort())) throw new Error('La cobertura de la captura no coincide con sus fechas.');
                }
            }
            return bundle;
        }
        async function restoreValues(values, hotel, mode = 'actual') {
            const checkpoint = await begin(null, { hotel, type: 'Restauración', mode });
            try {
                for (const key of KEYS) {
                    if (values[key] == null) storage.removeItem(key);
                    else storage.setItem(key, values[key]);
                    if ((storage.getItem(key) ?? null) !== values[key]) throw new Error('No se pudo restaurar ' + key);
                }
                return await commit(checkpoint);
            } catch (error) { await fail(checkpoint, error); throw error; }
        }
        return { begin, commit, fail, list, read, validateBackup, inspectFile,
            exportBackup: async () => ({ format: 'capasuite-revenue-backup', version: 1, exportedAt: now(), values: read(), records: await list() }),
            restore: async identifier => { const row = owned(await repository.get(identifier)); return restoreValues(row.before, row.hotel, row.mode); },
            restoreBackup: async (bundle, hotel, mode = 'actual') => {
                validateBackup(bundle);
                const result = await restoreValues(bundle.values, hotel, mode);
                const existing = new Set((await list()).map(origin));
                for (const record of bundle.records || []) {
                    if (existing.has(origin(record))) continue;
                    const imported = JSON.parse(JSON.stringify(record));
                    imported.originalId = imported.originalId || imported.id;
                    imported.originalOwner = imported.originalOwner || imported.owner;
                    imported.id = id(); imported.owner = owner();
                    await repository.put(imported);
                    existing.add(origin(imported));
                }
                return result;
            }
        };
    }
    const api = { observe, compare, validDate, createService, KEYS, repairWorkbook, repairSheet: repairSheetCells, ensureXLSXRepairs };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else {
        root.CapaRevenueHistory = { ...api, ...createService({ storage: root.CapaStorage, repository: indexedRepository(),
            owner: () => root.auth?.currentUser?.uid || root.CapaStorage.getItem('cloud_account_uid') || 'local' }) };
    }
})(typeof window === 'undefined' ? globalThis : window);
