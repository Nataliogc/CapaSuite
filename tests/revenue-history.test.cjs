const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/revenue-history.js');
const serialize = (forecast = {}, production = {}) => ({ segment_forecast_v2: JSON.stringify(forecast), hotel_manager_db_v2: JSON.stringify(production) });
const capture = (hotel, values, at = '2026-10-01T10:00:00Z', mode = 'forecast') => ({ hotel, mode, capturedAt: at, observation: H.observe(values, hotel, mode) });
const segment = days => ({ segment: { GRUPOS: { days } } });
function setup() {
    const values = Object.fromEntries(H.KEYS.map(k => [k, null])), records = new Map();
    let clock = 0, identifier = 0, account = 'local', failWrite = false;
    const repository = { async put(row) { if (failWrite) throw Error('quota'); records.set(row.id, structuredClone(row)); },
        async get(id) { return structuredClone(records.get(id)); }, async list(owner) { return [...records.values()].filter(r => r.owner === owner).map(r => structuredClone(r)); } };
    const service = H.createService({ storage: { getItem: k => values[k], setItem: (k, v) => values[k] = v, removeItem: k => values[k] = null }, repository,
        owner: () => account, now: () => `2026-10-01T10:00:${String(clock++).padStart(2, '0')}Z`, id: () => 'capture-' + ++identifier,
        hash: async () => 'fixture-hash' });
    return { service, values, records, account: a => account = a, fail: () => failWrite = true };
}

test('observations isolate hotels and use accommodation rather than total department revenue', () => {
    const values = serialize({ Guadiana: segment({ '2026-10-01': { rooms: 2, accommodation: 100, revenue: 150 } }), Cumbria: segment({ '2026-10-01': { rooms: 8, accommodation: 500 } }) });
    assert.deepEqual(H.observe(values, 'Guadiana', 'forecast').days['2026-10-01'], { rooms: 2, accommodation: 100 });
    assert.equal(H.observe(values, 'Cumbria', 'forecast').days['2026-10-01'].rooms, 8);
});

test('invalid and partially invalid segment dates are excluded rather than reported as zero', () => {
    const values = serialize({ Guadiana: { segment: {
        GRUPOS: { days: { '2026-02-31': { rooms: 2 }, '2026-10-01': { rooms: 4 } } },
        OTROS: { days: { '2026-10-01': { rooms: 'unknown' } } }
    } } });
    const result = H.observe(values, 'Guadiana', 'forecast');
    assert.deepEqual(result.coverage, []); assert.equal(result.issues.length, 2);
});

test('unknown lodging never becomes total revenue and verified zero remains zero', () => {
    const values = serialize({ Guadiana: segment({ '2026-10-01': { rooms: 2, revenue: 150, accommodation: 0, accommodationVerified: false }, '2026-10-02': { rooms: 0, accommodation: 0, accommodationVerified: true } }) });
    const days = H.observe(values, 'Guadiana', 'forecast').days;
    assert.equal(days['2026-10-01'].accommodation, null); assert.equal(days['2026-10-02'].accommodation, 0);
});

test('pickup measures explicit cancellations while excluding dates missing in either capture', () => {
    const previous = capture('Guadiana', serialize({ Guadiana: segment({ '2026-10-01': { rooms: 5, accommodation: 500 }, '2026-10-02': { rooms: 2, accommodation: 200 } }) }));
    const current = capture('Guadiana', serialize({ Guadiana: segment({ '2026-10-01': { rooms: 0, accommodation: 0 }, '2026-10-03': { rooms: 9, accommodation: 900 } }) }), '2026-10-02T10:00:00Z');
    const result = H.compare(previous, current, '2026-10');
    assert.equal(result.roomsDelta, -5); assert.equal(result.accommodationDelta, -500);
    assert.equal(result.matchedDays, 1); assert.equal(result.missing.length, 2); assert.equal(result.fullCoverage, false);
    assert.equal(H.compare(previous, current, '2026-11').available, false);
});

test('incompatible engines, hotels, modes and reversed observation dates cannot be compared', () => {
    const a = capture('Guadiana', serialize({ Guadiana: segment({ '2026-10-01': { rooms: 1 } }) }));
    for (const b of [{ ...a, hotel: 'Cumbria' }, { ...a, mode: 'actual' }, { ...a, observation: { ...a.observation, engine: 'daily-otb' } }, { ...a, capturedAt: '2025-10-01T10:00:00Z' }]) assert.equal(H.compare(a, b).available, false);
});

test('capture provenance includes immutable observation time and file identity', async () => {
    const s = setup();
    s.values.segment_forecast_v2 = JSON.stringify({ Guadiana: segment({ '2026-10-01': { rooms: 2 } }) });
    const id = await s.service.begin({ name: 'otb.xlsx', size: 12, lastModified: 1 }, { hotel: 'Guadiana', mode: 'forecast' });
    const row = await s.service.commit(id);
    s.values.segment_forecast_v2 = '{}';
    assert.equal(row.source.sha256, 'fixture-hash'); assert.equal(row.source.size, 12);
    assert.equal((await s.service.list('Guadiana'))[0].observation.days['2026-10-01'].rooms, 2);
    await assert.rejects(s.service.commit(id), /cerrada/);
});

test('history cannot commit to another account and lists stay account scoped', async () => {
    const s = setup(), id = await s.service.begin(null, { hotel: 'Guadiana' });
    s.account('other'); assert.deepEqual(await s.service.list(), []);
    await assert.rejects(s.service.commit(id), /cuenta activa/);
});

test('failed checkpoint storage prevents beginning an import without modifying current data', async () => {
    const s = setup(); s.values.hotel_manager_db_v2 = '{"Guadiana":{}}'; s.fail();
    await assert.rejects(s.service.begin(null, { hotel: 'Guadiana' }), /quota/);
    assert.equal(s.values.hotel_manager_db_v2, '{"Guadiana":{}}');
});

test('failed imports retain a recoverable pre-import copy and do not masquerade as observations', async () => {
    const s = setup(); s.values.hotel_manager_db_v2 = '{"Guadiana":{"2026":{}}}';
    const id = await s.service.begin(null, { hotel: 'Guadiana' });
    await s.service.fail(id, Error('invalid file'));
    const row = (await s.service.list())[0];
    assert.equal(row.status, 'failed'); assert.equal(row.observation, undefined);
    assert.equal(row.before.hotel_manager_db_v2, s.values.hotel_manager_db_v2);
});

test('restoring a checkpoint preserves a copy of the replaced state', async () => {
    const s = setup(); s.values.hotel_manager_db_v2 = '{"Guadiana":{"2026":1}}';
    const id = await s.service.begin(null, { hotel: 'Guadiana' });
    s.values.hotel_manager_db_v2 = '{"Guadiana":{"2026":2}}'; await s.service.fail(id, 'invalid data');
    const restoration = await s.service.restore(id);
    assert.equal(s.values.hotel_manager_db_v2, '{"Guadiana":{"2026":1}}');
    assert.equal(restoration.before.hotel_manager_db_v2, '{"Guadiana":{"2026":2}}');
});

test('backup roundtrip restores data and transfers provenance and observations into the active account', async () => {
    const source = setup(); source.values.segment_forecast_v2 = JSON.stringify({ Guadiana: segment({ '2026-10-01': { rooms: 2 } }) });
    const id = await source.service.begin({ name: 'otb.xlsx' }, { hotel: 'Guadiana', mode: 'forecast' }); await source.service.commit(id);
    const bundle = await source.service.exportBackup(), target = setup(); target.account('new-account');
    await target.service.restoreBackup(bundle, 'Guadiana');
    assert.equal(target.values.segment_forecast_v2, source.values.segment_forecast_v2);
    const rows = await target.service.list(); assert.equal(rows.length, 2);
    assert.ok(rows.every(r => r.owner === 'new-account'));
    assert.equal(rows.find(r => r.source.name === 'otb.xlsx').observation.days['2026-10-01'].rooms, 2);
    await target.service.restoreBackup(bundle, 'Guadiana');
    assert.equal((await target.service.list()).filter(r => r.source.name === 'otb.xlsx').length, 1);
});

test('malformed, incomplete and invalid-history backups are rejected before writing data', async () => {
    const s = setup(), valid = await s.service.exportBackup();
    const incomplete = structuredClone(valid); delete incomplete.values.custom_events;
    const unknown = structuredClone(valid); unknown.values.password = 'secret';
    const invalid = structuredClone(valid); invalid.values.hotel_manager_db_v2 = 'invalid-json';
    const badRecord = structuredClone(valid); badRecord.records = [{ hotel: 'Unknown' }];
    for (const bundle of [incomplete, unknown, invalid, badRecord]) await assert.rejects(s.service.restoreBackup(bundle, 'Guadiana'));
    assert.equal((await s.service.list()).length, 0); assert.equal(s.values.hotel_manager_db_v2, null);
});
