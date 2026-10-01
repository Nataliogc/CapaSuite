const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../js/revenue-history.js');
const fs = require('node:fs');
const vm = require('node:vm');
function setup() {
    const rows = new Map(); let id = 0, account = 'local';
    const service = H.createService({ storage: { getItem: () => null },
        repository: { put: async r => rows.set(r.id, structuredClone(r)), get: async id => structuredClone(rows.get(id)), list: async owner => [...rows.values()].filter(r => r.owner === owner) },
        owner: () => account, id: () => String(++id), hash: async f => f?.bytes || null, contentHash: async f => f?.content || null });
    return { service, rows, account: value => account = value };
}
const meta = { hotel: 'Guadiana', type: 'Prod', mode: 'actual' };
const file = { name: 'produccion.xlsx', bytes: 'hash-1', content: 'cells-1' };
test('identical bytes renamed cannot create another checkpoint or import', async () => {
    const { service, rows } = setup(); await service.commit(await service.begin(file, meta));
    assert.equal((await service.inspectFile({ ...file, name: 'otra.xlsx' }, meta)).status, 'duplicate');
    await assert.rejects(service.begin({ ...file, name: 'otra.xlsx' }, meta), /mismos datos/);
    assert.equal(rows.size, 1);
});
test('re-saved workbooks with identical cell content are blocked despite changed bytes', async () => {
    const { service } = setup(); await service.commit(await service.begin(file, meta));
    assert.equal((await service.inspectFile({ ...file, bytes: 'hash-2' }, meta)).status, 'duplicate');
});
test('changed same-name content is identified and admitted', async () => {
    const { service } = setup(); await service.commit(await service.begin(file, meta));
    const changed = { ...file, bytes: 'hash-2', content: 'cells-2' };
    assert.equal((await service.inspectFile(changed, meta)).status, 'changed');
    assert.ok(await service.begin(changed, meta));
});
test('failed imports may retry and hotel/account boundaries remain separate', async () => {
    const state = setup(); await state.service.fail(await state.service.begin(file, meta), 'failed');
    assert.equal((await state.service.inspectFile(file, meta)).status, 'new');
    await state.service.commit(await state.service.begin(file, meta));
    assert.equal((await state.service.inspectFile(file, { ...meta, hotel: 'Cumbria' })).status, 'new');
    state.account('other'); assert.equal((await state.service.inspectFile(file, meta)).status, 'new');
});
test('legacy name-only registrations are never proof of duplicates and missing hash blocks import', async () => {
    const { service, rows } = setup(); rows.set('legacy', { owner: 'local', hotel: 'Guadiana', status: 'committed', source: { name: file.name } });
    assert.equal((await service.inspectFile(file, meta)).status, 'new');
    await assert.rejects(service.begin({ name: file.name }, meta), /verificar/);
});
test('Segmentacion names route to the segment parser for both production and forecasts', () => {
    const html = fs.readFileSync('CargarDatos.html', 'utf8');
    const start = html.indexOf('        function detectFileType(name)');
    const end = html.indexOf('        function setupDropZones()', start);
    const context = vm.createContext({ normalizeStr: value => value.toUpperCase() });
    vm.runInContext(html.slice(start, end), context);
    for (const hotel of ['Guadiana', 'Cumbria']) {
        assert.equal(context.detectFileType(hotel + ' Segmentacion Previsiones Valoradas.xlsx'), 'Seg');
        assert.equal(context.detectFileType(hotel + ' Segmentacion Produccion.xlsx'), 'Seg');
        assert.equal(context.detectFileType(hotel + ' Previsiones Valoradas.xlsx'), 'Otb');
        assert.equal(context.detectFileType(hotel + ' Produccion.xlsx'), 'Prod');
    }
});
test('malformed cell references fail before creating an import checkpoint', async () => {
    const context = vm.createContext({ module: { exports: {} }, TextEncoder, crypto: require('node:crypto').webcrypto,
        XLSX: { read: () => ({ SheetNames: ['Hoja1'], Sheets: { Hoja1: { 'B@3': { v: '01/10' } } } }) } });
    vm.runInContext(fs.readFileSync('js/revenue-history.js', 'utf8'), context);
    let writes = 0;
    const service = context.module.exports.createService({ storage: { getItem: () => null }, repository: { list: async () => [], put: async () => writes++ }, owner: () => 'test', hash: async () => 'bytes' });
    await assert.rejects(service.begin({ name: 'bad.xlsx', arrayBuffer: async () => new ArrayBuffer(0) }, meta), /referencias de celda no válidas/);
    assert.equal(writes, 0);
});
